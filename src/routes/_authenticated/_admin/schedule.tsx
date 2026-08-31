import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { WeekSchedule } from "@/features/schedule/components/week-schedule";

export const Route = createFileRoute("/_authenticated/_admin/schedule")({
  component: SchedulePage,
});

/**
 * The week, as a timetable. Wider than the dashboard's today-and-tomorrow, and
 * narrower than the groups list: this is the one page that answers "when is
 * everything on?" rather than "what is this group doing?".
 */
function SchedulePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* The page's name is the bar, in the mark's place — "TeacherSchedule" as
          one lockup. A heading below it would be the same word twice. */}
      <SiteNav
        backTo="/lessons"
        backLabel="Back to lessons"
        // titlePrefix="Teacher"
        title="schedule"
      />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10">
        <WeekSchedule />
      </main>
    </div>
  );
}
