// practice-audio: the voices of listening practice, made with ElevenLabs.
//
// The Studio's listening editor calls this for two things:
//
//   { action: "voices" }
//       → { voices: [{ id, name, description }] }
//       The ElevenLabs voices on the account, to pick one from.
//
//   { action: "generate", activityId, cardId, text, voiceId, previousPath? }
//       → { path }
//       Speaks `text` in that voice, stores the mp3 in the `practice-audio`
//       bucket (0032) and returns its object path — what the card keeps. The
//       file it replaces, if any, is removed.
//
// Here rather than in the browser because the API key can't be: it would be
// readable by anybody with the Studio open. Staff only, like the Studio.
//
// Secrets (supabase secrets set …):
//   ELEVENLABS_API_KEY    required
//   ELEVENLABS_MODEL_ID   optional, default eleven_multilingual_v2
//
// Deploy: supabase functions deploy practice-audio

import { z } from "npm:zod@^4.4.3";
import { handle, HttpError, json, requireStaff } from "../_shared/admin.ts";

const API = "https://api.elevenlabs.io/v1";
const BUCKET = "practice-audio";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("voices") }),
  z.object({
    action: z.literal("generate"),
    activityId: z.string().trim().min(1).max(200),
    cardId: z.string().trim().min(1).max(200),
    // A practice sentence, not an audiobook: the cap keeps a slip of the paste
    // from spending the month's characters.
    text: z.string().trim().min(1).max(500),
    voiceId: z.string().trim().min(1).max(100),
    previousPath: z.string().max(500).optional(),
  }),
]);

function apiKey(): string {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) {
    throw new HttpError(
      500,
      "ELEVENLABS_API_KEY is not set. Run: supabase secrets set ELEVENLABS_API_KEY=…",
    );
  }
  return key;
}

/** What ElevenLabs said went wrong, rather than just its status. */
async function elevenLabsError(response: Response): Promise<HttpError> {
  let detail = `${response.status} ${response.statusText}`;
  try {
    const body = await response.json();
    const message = body?.detail?.message ?? body?.detail ?? body?.message;
    if (message) detail = typeof message === "string" ? message : JSON.stringify(message);
  } catch {
    // Not JSON — the status will do.
  }
  return new HttpError(502, `ElevenLabs: ${detail}`);
}

/** Safe in an object path: the slug and the card id are ours, but a path is no
 *  place to find out otherwise. */
function segment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 120);
}

Deno.serve(
  handle(async (req) => {
    const { service } = await requireStaff(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    const body = parsed.data;

    if (body.action === "voices") {
      const response = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey() } });
      if (!response.ok) throw await elevenLabsError(response);
      const data = (await response.json()) as {
        voices?: { voice_id: string; name: string; labels?: Record<string, string> }[];
      };
      const voices = (data.voices ?? [])
        .map((voice) => ({
          id: voice.voice_id,
          name: voice.name,
          description: Object.values(voice.labels ?? {}).filter(Boolean).join(" · "),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return json({ voices });
    }

    const model = Deno.env.get("ELEVENLABS_MODEL_ID") || "eleven_multilingual_v2";
    const response = await fetch(
      `${API}/text-to-speech/${encodeURIComponent(body.voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({ text: body.text, model_id: model }),
      },
    );
    if (!response.ok) throw await elevenLabsError(response);
    const audio = new Uint8Array(await response.arrayBuffer());

    // A new name every time, so neither the CDN nor the app's cache can serve
    // the old sentence under the new one's address.
    const path = `${segment(body.activityId)}/${segment(body.cardId)}-${Date.now().toString(36)}.mp3`;
    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, audio, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: false });
    if (uploadError) throw new HttpError(500, uploadError.message);

    // The old file goes only once the new one is safely stored. A failure here
    // leaves an orphan, not a card without audio, so it is not worth failing for.
    if (body.previousPath && body.previousPath !== path) {
      await service.storage.from(BUCKET).remove([body.previousPath]);
    }

    return json({ path });
  }),
);
