// Guards shared by the routes that aren't for everyone on staff.
//
// The `_admin` layout only asks whether you're staff, so anything narrower than
// that says so for itself. Both of these send the user to /lessons rather than
// to a refusal page: there is nothing for them to do about it.

import { redirect } from "@tanstack/react-router";

import { canUseAdvancedStudio, getCurrentProfile } from "@/lib/profile";

/** The studio proper — the shared lesson, material and homework library. */
export async function requireAdmin(): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw redirect({ to: "/lessons" });
}

/** The advanced context editor, which a teacher is granted one at a time. */
export async function requireAdvancedStudio(): Promise<void> {
  if (!canUseAdvancedStudio(await getCurrentProfile())) {
    throw redirect({ to: "/lessons" });
  }
}
