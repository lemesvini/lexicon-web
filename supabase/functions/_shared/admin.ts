// Shared plumbing for the admin-only Edge Functions.
//
// These functions exist for one reason: creating a student's auth account needs
// the service_role key, and this app is a browser-only Vite SPA — there is
// nowhere in it that a service_role key could live safely. So the privileged
// calls happen here, behind a check that the caller is a signed-in admin.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into every Edge
// Function by the platform; neither needs to be configured as a secret.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** The browser calls these functions directly, so preflight has to be answered. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** An error carrying the HTTP status the client should see. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * A service_role client: bypasses RLS, so only ever used after requireAdmin.
 *
 * Two key names, because there are two generations of them. A project on the new
 * API keys has `SUPABASE_SECRET_KEY` (an `sb_secret_…` string); one still on the
 * legacy JWT keys has `SUPABASE_SERVICE_ROLE_KEY`. Both are injected by the
 * platform, but a project that has *disabled* its legacy keys keeps the old
 * variable while it is no longer worth anything — so prefer the new name and
 * fall back, rather than picking one and hoping.
 *
 * Throwing when neither is set matters more than it looks: without it the empty
 * key sails on to `auth.getUser()` below, which fails the way a bad JWT does, and
 * the caller gets told their *session* expired — a misdiagnosis that sends you
 * looking at the browser instead of the project's keys.
 */
export function serviceClient(): SupabaseClient {
  const key =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

  if (!key) {
    throw new HttpError(
      500,
      "This function has no service key. Check that the project's API keys are enabled (Project Settings → API Keys).",
    );
  }

  return createClient(Deno.env.get("SUPABASE_URL") ?? "", key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** What the caller turned out to be, once their JWT and profile check out. */
export type Caller = {
  service: SupabaseClient;
  callerId: string;
  role: "admin" | "teacher";
  isAdmin: boolean;
};

/**
 * Verifies the caller's JWT and that their profile is staff — an admin, or a
 * teacher who is still active. Throws {@link HttpError} otherwise.
 *
 * The role comes back with it, because the callers that accept both need to
 * treat them differently: a teacher acts only on their own students, an admin on
 * anyone's. See supabase/migrations/0006_teachers.sql.
 */
export async function requireStaff(req: Request): Promise<Caller> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError(401, "Missing authorization header.");

  const service = serviceClient();

  const { data: userData, error: userError } = await service.auth.getUser(jwt);
  if (userError || !userData.user) {
    // The gateway verifies the JWT before this function is ever invoked
    // (`verify_jwt` is on for all four), so by the time we get here the token has
    // already been checked once and passed. A failure now therefore says more
    // about this end than about the caller — most often a service key that the
    // project no longer honours — so the underlying reason is carried out rather
    // than flattened into "your session expired", which it almost never is.
    throw new HttpError(
      401,
      userError
        ? `Could not verify the caller: ${userError.message}`
        : "Invalid or expired session.",
    );
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role, status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw new HttpError(500, profileError.message);

  const role = profile?.role;
  const isActiveTeacher = role === "teacher" && profile?.status !== "inactive";
  if (role !== "admin" && !isActiveTeacher) {
    throw new HttpError(403, "Only a teacher can do this.");
  }

  return {
    service,
    callerId: userData.user.id,
    role: role === "admin" ? "admin" : "teacher",
    isAdmin: role === "admin",
  };
}

/** As {@link requireStaff}, but for the things only the admin may do. */
export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireStaff(req);
  if (!caller.isAdmin) throw new HttpError(403, "Only an admin can do this.");
  return caller;
}

// Ambiguous glyphs (0/O, 1/l/I) are left out: this password gets read off a
// screen and typed by hand, or dictated over the phone.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random temporary password, shown to the admin once and then unrecoverable. */
export function generateTempPassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }
  return out;
}

/**
 * Wraps a handler with CORS preflight, method check, and HttpError → response
 * mapping, so each function file is just its own logic.
 */
export function handle(
  fn: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, err.status);
      }
      console.error(err);
      return json({ error: (err as Error).message ?? "Unexpected error." }, 500);
    }
  };
}
