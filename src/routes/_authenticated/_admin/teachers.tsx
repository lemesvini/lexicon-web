import { createFileRoute, redirect } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { getCurrentProfile } from "@/lib/profile";
import { TeachersList } from "@/features/teachers/components/teachers-list";

/**
 * The one page under `_admin/` that isn't shared with teachers — everything else
 * they see is what the admin sees. Hence a second guard here on top of the
 * layout's: `_admin` only asks whether you're staff.
 *
 * A teacher who types the URL is sent to their own homepage rather than shown a
 * "not allowed" page: there is nothing for them to do about it.
 */
export const Route = createFileRoute("/_authenticated/_admin/teachers")({
  beforeLoad: async () => {
    const profile = await getCurrentProfile();

    if (profile?.role !== "admin") {
      throw redirect({ to: "/lessons" });
    }
  },
  component: TeachersPage,
});

function TeachersPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground">
            Who can sign in to teach. Each one keeps their own students; the
            lesson library, the modules and the homework are shared.
          </p>
        </div>

        <TeachersList />
      </main>
    </div>
  );
}
