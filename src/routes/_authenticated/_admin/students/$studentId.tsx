import { createFileRoute } from "@tanstack/react-router";

import { StudentDashboard } from "@/features/students/components/student-dashboard";

export const Route = createFileRoute("/_authenticated/_admin/students/$studentId")({
  component: StudentRoute,
});

/**
 * One student's dashboard, reached by clicking their row on the roster.
 *
 * The dashboard lays out its own frame, header included — opening one of its
 * listings pushes the whole page left to make room for the rail, and the
 * header has to travel with it.
 *
 * Keyed on the id so that moving between two students remounts rather than
 * updates — every piece of state under here (the context note's draft in
 * particular) belongs to one student, and carrying a half-typed note across to
 * the next one is the kind of bug nobody notices until it has been saved.
 */
function StudentRoute() {
  const { studentId } = Route.useParams();

  return <StudentDashboard key={studentId} studentId={studentId} />;
}
