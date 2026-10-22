// send-push: delivers the rows of `notifications` (0036) to the students'
// phones, through Expo's push service.
//
// Nobody calls this by hand. The database does, through pg_net: once after any
// insert into `notifications` (a correction, a unit report, the class
// reminders), and from the every-minute cron job for anything left unsent. Each
// call drains what is due:
//
//   claim_push_batch    takes up to 200 notifications, with their devices' tokens
//   → Expo              one message per device, 100 to a request
//   settle_push_batch   marks them sent, or hands them back for the next try,
//                       and forgets devices Expo says are gone
//
// The caller is the database, not a user, so there is no JWT to verify (see
// `verify_jwt = false` in config.toml). It proves itself with a shared secret
// instead: the `x-dispatch-secret` header, which `dispatch_push()` reads from
// the Vault.
//
// Secrets (supabase secrets set …):
//   PUSH_DISPATCH_SECRET   required — the same string as the Vault's
//                          `push_dispatch_secret`
//   EXPO_ACCESS_TOKEN      required — the project has "Enhanced security for
//                          push notifications" on, so Expo refuses sends
//                          without it
//
// Deploy: supabase functions deploy send-push

import { handle, HttpError, json, serviceClient } from "../_shared/admin.ts";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
/** Expo's cap on messages per request. */
const MESSAGES_PER_REQUEST = 100;
const BATCH_SIZE = 200;
/** Enough for any real backlog; a bound so a bug can't loop forever. */
const MAX_BATCHES = 10;

/** The Android channels the app creates (lexicon-mobile's
 *  src/features/notifications/channels.ts). A channel the phone doesn't have
 *  drops the notification, so these must match. */
const CHANNELS: Record<string, string> = {
  homework_graded: "activity",
  unit_report: "activity",
  class_reminder: "classes",
};

type Claimed = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  tokens: string[];
};

type Message = {
  to: string;
  title: string;
  body: string;
  data: { url: string | null; notificationId: string };
  sound: "default";
  channelId: string;
  priority: "high";
};

type Ticket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type Outcome = { sent: string[]; failed: string[]; deadTokens: string[]; error: string | null };

function requireSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, `${name} is not set. Run: supabase secrets set ${name}=…`);
  }
  return value;
}

/** Compares in constant time, so the secret can't be guessed a byte at a time. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

async function send(messages: Message[], accessToken: string): Promise<Ticket[]> {
  const response = await fetch(EXPO_SEND_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Expo ${response.status}: ${detail.slice(0, 300)}`);
  }

  const { data } = (await response.json()) as { data: Ticket[] };
  return data;
}

/**
 * Sends one message per device, and works out what happened to each
 * notification. A notification is sent once any of its devices took it — a
 * retry would repeat it on that one. It goes back for another try only if no
 * device took it and a request failed outright (Expo down, rate-limited). A
 * ticket refused for any other reason won't do better on a second go.
 */
async function deliver(batch: Claimed[], accessToken: string): Promise<Outcome> {
  const messages: Message[] = batch.flatMap((n) =>
    n.tokens.map((token) => ({
      to: token,
      title: n.title,
      body: n.body,
      data: { url: n.url, notificationId: n.id },
      sound: "default" as const,
      channelId: CHANNELS[n.kind] ?? "activity",
      priority: "high" as const,
    })),
  );

  const delivered = new Set<string>();
  const requestFailed = new Set<string>();
  const deadTokens: string[] = [];
  let error: string | null = null;

  for (let start = 0; start < messages.length; start += MESSAGES_PER_REQUEST) {
    const chunk = messages.slice(start, start + MESSAGES_PER_REQUEST);
    try {
      const tickets = await send(chunk, accessToken);
      tickets.forEach((ticket, i) => {
        const message = chunk[i];
        if (!message) return;
        if (ticket.status === "ok") {
          delivered.add(message.data.notificationId);
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          deadTokens.push(message.to);
        } else {
          console.warn(`push to ${message.to} refused: ${ticket.message}`);
        }
      });
    } catch (err) {
      error = (err as Error).message;
      console.error(error);
      for (const message of chunk) requestFailed.add(message.data.notificationId);
    }
  }

  const sent: string[] = [];
  const failed: string[] = [];
  for (const n of batch) {
    if (!delivered.has(n.id) && requestFailed.has(n.id)) failed.push(n.id);
    else sent.push(n.id);
  }

  return { sent, failed, deadTokens, error };
}

Deno.serve(
  handle(async (req) => {
    const secret = requireSecret("PUSH_DISPATCH_SECRET");
    if (!sameSecret(req.headers.get("x-dispatch-secret") ?? "", secret)) {
      throw new HttpError(401, "Not the database.");
    }
    const accessToken = requireSecret("EXPO_ACCESS_TOKEN");
    const service = serviceClient();

    let sent = 0;
    let failed = 0;

    for (let round = 0; round < MAX_BATCHES; round++) {
      const { data, error } = await service.rpc("claim_push_batch", { p_limit: BATCH_SIZE });
      if (error) throw new HttpError(500, error.message);

      const batch = (data ?? []) as Claimed[];
      if (batch.length === 0) break;

      const outcome = await deliver(batch, accessToken);
      const { error: settleError } = await service.rpc("settle_push_batch", {
        p_sent: outcome.sent,
        p_failed: outcome.failed,
        p_error: outcome.error,
        p_dead_tokens: outcome.deadTokens,
      });
      if (settleError) throw new HttpError(500, settleError.message);

      sent += outcome.sent.length;
      failed += outcome.failed.length;
      // Expo is failing: leave the rest for the cron job rather than claiming
      // batch after batch only to hand them back.
      if (outcome.failed.length > 0) break;
    }

    return json({ sent, failed });
  }),
);
