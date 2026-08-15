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

/** A service_role client: bypasses RLS, so only ever used after requireAdmin. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Verifies the caller's JWT and that their profile carries the admin role.
 * Throws {@link HttpError} otherwise. Returns the service client plus the
 * caller's id, which is what the callers need next.
 */
export async function requireAdmin(
  req: Request,
): Promise<{ service: SupabaseClient; callerId: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError(401, "Missing authorization header.");

  const service = serviceClient();

  const { data: userData, error: userError } = await service.auth.getUser(jwt);
  if (userError || !userData.user) {
    throw new HttpError(401, "Invalid or expired session.");
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw new HttpError(500, profileError.message);
  if (profile?.role !== "admin") {
    throw new HttpError(403, "Only an admin can do this.");
  }

  return { service, callerId: userData.user.id };
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
