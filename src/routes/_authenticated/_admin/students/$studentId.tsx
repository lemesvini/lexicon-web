import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { StudentDashboard } from "@/features/students/components/student-dashboard";

export const Route = createFileRoute("/_authenticated/_admin/students/$studentId")({
  component: StudentRoute,
});

/**
 * One student's dashboard, reached by clicking their row on the roster.
 *
 * Keyed on the id so that moving between two students remounts rather than
 * updates — every piece of state under here (the notes draft in particular)
 * belongs to one student, and carrying a half-typed note across to the next one
 * is the kind of bug nobody notices until it has been saved.
 */
function StudentRoute() {
  const { studentId } = Route.useParams();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/students" backLabel="Back to the roster" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4">
        <StudentDashboard key={studentId} studentId={studentId} />
      </main>
    </div>
  );
}
