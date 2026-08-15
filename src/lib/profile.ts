// The signed-in user's profile — chiefly their role, which decides whether they
// land in the teacher app or the student app.
//
// See supabase/migrations/0002_students_and_access.sql: every auth user has
// exactly one `profiles` row, and RLS lets them read their own.

import { supabase } from "@/lib/supabase";

export type Role = "admin" | "student";

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

/**
 * Cached because the route guards need the role, and TanStack Router's
 * `beforeLoad` runs outside React — it can't read the AuthProvider, so without a
 * cache every navigation would round-trip to Supabase before rendering.
 *
 * The cache holds the in-flight promise, not just the result, so guards firing
 * in parallel on a hard refresh share one request.
 */
let cached: { userId: string; promise: Promise<Profile | null> } | null = null;

export function clearProfileCache() {
  cached = null;
}

// Any change of identity invalidates the cache. Registered at module scope so it
// is in place before the first guard runs, whatever imports this first.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
    clearProfileCache();
  }
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    email: data.email ?? "",
    fullName: data.full_name ?? "",
    role: data.role === "admin" ? "admin" : "student",
  };
}

/**
 * The current user's profile, or null when signed out or when the row is
 * missing (which shouldn't happen — a trigger creates it — but is treated as
 * "not an admin" rather than as an error).
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    cached = null;
    return null;
  }

  if (cached?.userId === userId) return cached.promise;

  const promise = fetchProfile(userId).catch((err) => {
    // Don't cache a failure: a dropped request would otherwise lock the user
    // out until a full reload.
    if (cached?.userId === userId) cached = null;
    throw err;
  });

  cached = { userId, promise };
  return promise;
}

/**
 * Whether the user must set a new password before doing anything else. Set on
 * the account by the admin Edge Functions when they issue a temporary password,
 * and cleared by the change-password screen.
 */
export function mustChangePassword(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return user?.user_metadata?.must_change_password === true;
}
