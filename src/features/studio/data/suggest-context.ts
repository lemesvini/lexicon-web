// Asking Claude for advanced context, watching it think, and refusing anything it
// gets wrong.
//
// The validation below is not belt-and-braces. `parseLesson` checks that a
// document is an object with a `slides` array and nothing else (see ../model.ts);
// a block with a colour that doesn't exist either renders as the wrong thing or
// throws inside its own renderer, and the surface it throws on is a projector in
// front of a class. Since nothing downstream will catch a bad enum, it has to be
// caught here, before the block can reach the document at all.
//
// A suggestion that fails is dropped and counted, not repaired. Guessing what a
// model meant is how a mangled table gets waved through; the teacher is better
// served by "two suggestions were malformed" and four good ones.
//
// The transport is a raw `fetch` rather than `supabase.functions.invoke` because
// the function streams: the reasoning arrives while the model works, and invoke
// buffers the whole body before handing it over. The distrust is unchanged — only
// the pipe is.

import { z } from "zod";

import type { LessonBlock } from "@/lib/lessons";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Shared optional trimmings. */
const label = z.string().optional();
const note = z.string().optional();

// One schema per block type the function is allowed to propose. These mirror
// @/lib/lessons exactly — when a block shape changes there, it changes here.
const textBlock = z.object({
  type: z.literal("text"),
  label,
  body: z.string().min(1),
  note,
});

const listBlock = z.object({
  type: z.literal("list"),
  label,
  // Required, with no default. A list block missing this renders nothing.
  style: z.enum(["numbered", "bullet", "checklist"]),
  items: z.array(z.string()).min(1),
  note,
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  icon: z.string().optional(),
  // NOT the title block's colours. Same field name, disjoint values — the trap
  // docs/lesson-json.md opens with.
  color: z
    .enum(["blue_bg", "green_bg", "yellow_bg", "gray_bg", "red_bg"])
    .optional(),
  title: z.string().min(1),
  body: z.string().min(1),
});

const dialogBlock = z.object({
  type: z.literal("dialog"),
  label,
  note,
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
});

const tableBlock = z.object({
  type: z.literal("table"),
  label,
  note,
  // Column-major. A row-major answer parses as columns with the wrong titles,
  // which is why `rows` being an array of strings is checked rather than assumed.
  columns: z
    .array(z.object({ title: z.string(), rows: z.array(z.string()) }))
    .min(1),
});

const suggestedBlock = z.discriminatedUnion("type", [
  textBlock,
  listBlock,
  calloutBlock,
  dialogBlock,
  tableBlock,
]);

const suggestion = z.object({
  /** The id of the existing slide the new one goes after. */
  afterSlideId: z.string().min(1),
  /** The new slide's stage name — content, not an administrative label. */
  stage: z.string().min(1),
  rationale: z.string(),
  blocks: z.array(suggestedBlock).min(1).max(4),
});

/** One proposed slide, ready to preview and insert. */
export type ContextSuggestion = {
  afterSlideId: string;
  stage: string;
  rationale: string;
  blocks: LessonBlock[];
};

export type SuggestionResult = {
  suggestions: ContextSuggestion[];
  /** How many the model returned that didn't survive validation. Shown rather
   *  than swallowed: a run where half were dropped is worth knowing about. */
  discarded: number;
};

/** One earlier turn of this conversation, as the model should read it back. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type SuggestOptions = {
  /** What the teacher typed this turn. What is permanently true of the class
   *  belongs in the class context, which the function already reads. */
  teacherPrompt?: string;
  /** The exchanges before this one, oldest first. The function caches everything
   *  up to the last of them, so carrying the conversation costs less per turn
   *  than starting fresh would. */
  history?: ChatMessage[];
  /** Called with each chunk of the model's reasoning as it arrives. */
  onThinking?: (delta: string) => void;
  /** Aborts the request, which also stops the model call server-side. */
  signal?: AbortSignal;
};

/**
 * Asks the edge function for slides to add to this group's copy of this lesson.
 *
 * The function does the reading — the class's context, every student's notes,
 * unit reports and handed-in homework, and what has already been added for this
 * class in earlier lessons — because that material has no business being
 * assembled in a browser. What goes over the wire from here is which group, which
 * lesson, whatever the teacher typed, and the conversation so far.
 */
export async function suggestAdvancedContext(
  groupId: string,
  lessonId: string,
  options: SuggestOptions = {},
): Promise<SuggestionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You're signed out. Sign in and try again.");

  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/functions/v1/suggest-advanced-context`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId,
        lessonId,
        teacherPrompt: options.teacherPrompt,
        history: options.history,
      }),
      signal: options.signal,
    },
  );

  // A failure before the stream opens is still a JSON body with a status — the
  // function only switches to `text/event-stream` once it has everything it needs.
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `The request failed (${response.status}).`);
  }

  // A 200 that isn't a stream means the deployed function predates streaming.
  // Worth naming precisely: parsing it as SSE finds no frames, runs the body out,
  // and reports "the connection closed" — which sends you looking at the network
  // instead of at the deploy.
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      suggestions?: unknown[];
    } | null;

    if (body?.error) throw new Error(body.error);
    if (Array.isArray(body?.suggestions)) {
      throw new Error(
        "The deployed suggest-advanced-context function is an older version that doesn't stream. Run: supabase functions deploy suggest-advanced-context",
      );
    }
    throw new Error(
      `The function answered with ${contentType || "no content type"} instead of a stream.`,
    );
  }

  const raw = await readSuggestions(response.body, options.onThinking);
  return validate(raw);
}

/**
 * Reads the SSE body, feeding reasoning out as it arrives and returning the
 * suggestions when they land.
 *
 * Only the reasoning streams. The tool's input arrives as partial-JSON deltas
 * that can't be parsed incrementally without guessing where an object ends, so
 * the suggestions come in one `result` event at the end — which is fine, because
 * what the teacher is waiting to watch is the thinking.
 */
async function readSuggestions(
  body: ReadableStream<Uint8Array>,
  onThinking?: (delta: string) => void,
): Promise<unknown[]> {
  // Decoded by hand rather than through `TextDecoderStream`: a UTF-8 character can
  // straddle two chunks, and `{ stream: true }` is what holds the halves together
  // — which matters here because the reasoning is full of em dashes and accented
  // student names.
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let suggestions: unknown[] | null = null;
  let failure: string | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. Anything after the last one is a
    // partial frame — leave it in the buffer for the next chunk.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let event = "message";
      const dataLines: string[] = [];

      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;

      let data: unknown;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }

      if (event === "thinking") {
        const delta = (data as { delta?: unknown }).delta;
        if (typeof delta === "string") onThinking?.(delta);
      } else if (event === "result") {
        const value = (data as { suggestions?: unknown }).suggestions;
        suggestions = Array.isArray(value) ? value : [];
      } else if (event === "error") {
        const message = (data as { error?: unknown }).error;
        failure = typeof message === "string" ? message : "The model call failed.";
      }
    }
  }

  if (failure) throw new Error(failure);
  if (!suggestions) {
    // The stream ended without either event — a dropped connection, or the
    // function dying mid-flight. Saying so is better than showing an empty list,
    // which reads as "the model had nothing to suggest".
    throw new Error("The connection closed before the suggestions arrived.");
  }
  return suggestions;
}

function validate(raw: unknown[]): SuggestionResult {
  const suggestions: ContextSuggestion[] = [];
  let discarded = 0;

  for (const item of raw) {
    const parsed = suggestion.safeParse(item);
    if (parsed.success) {
      suggestions.push({
        afterSlideId: parsed.data.afterSlideId,
        stage: parsed.data.stage,
        rationale: parsed.data.rationale,
        blocks: parsed.data.blocks as LessonBlock[],
      });
    } else {
      discarded += 1;
    }
  }

  return { suggestions, discarded };
}
