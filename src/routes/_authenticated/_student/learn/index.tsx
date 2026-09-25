import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpenIcon,
  DumbbellIcon,
  NotebookPenIcon,
  SparklesIcon,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { DashboardCard } from "@/features/learn/components/dashboard-card";
import { OnboardingCta } from "@/features/onboarding/components/onboarding-cta";
import {
  listMySubmissions,
  listStudentHomework,
  listStudentSyllabus,
  type StudentHomework,
  type StudentSubmission,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/learn/")({
  component: LearnPage,
});

/**
 * The student's homepage: what's waiting on them, then the four places their
 * app goes.
 *
 * The lesson list used to be here. It isn't a homepage — it is one of the
 * things a homepage points at, and a student arriving to do their homework had
 * to read past it. The counts are fetched here rather than on the cards so the
 * page makes one round trip; a card whose count hasn't landed says nothing
 * rather than a zero it would have to take back.
 */
function LearnPage() {
  const { access } = Route.useRouteContext();

  const [lessons, setLessons] = React.useState<number | null>(null);
  const [homework, setHomework] = React.useState<StudentHomework[]>([]);
  const [submissions, setSubmissions] = React.useState<
    Map<string, StudentSubmission>
  >(new Map());
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      listStudentSyllabus(),
      listStudentHomework(),
      listMySubmissions(),
    ])
      .then(([lessonRows, homeworkRows, mine]) => {
        if (cancelled) return;
        setLessons(lessonRows.length);
        setHomework(homeworkRows);
        setSubmissions(mine);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The lessons stay shut until the onboarding is answered — the answers are
  // what the lessons get built around, so reading them first is backwards.
  const locked = !access.onboardedAt;

  const todo = homework.filter((task) => {
    const submission = submissions.get(task.id);
    return !submission || submission.status === "in_progress";
  }).length;

  // The module's name is the useful half; how many lessons are in it goes in
  // the card's badge, where a number reads faster than it does in a sentence.
  // A module name is a name — "Book One" stays "Book One" in either language.
  const lessonsLine = locked
    ? "Termine seu onboarding para liberar"
    : (access.moduleName ?? "Nenhum módulo atribuído ainda");

  const homeworkLine =
    status !== "ready"
      ? "Suas tarefas do módulo"
      : todo > 0
        ? `${todo} esperando por você`
        : homework.length === 0
          ? "Nada passado ainda"
          : "Você está em dia";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <div>
          <p className="font-display text-3xl tracking-wide text-foreground">
            Hello {access.fullName.split(" ")[0] || "there"}!
          </p>
          <span className="text-sm text-muted-foreground font-montserrat">
            Access your classes and homeworks here
          </span>
        </div>

        {/* The one banner left on the page. It stays a banner because it is not
            a place to go — it is the thing that has to happen before the cards
            under it work. */}
        <OnboardingCta done={!locked} />

        {/* Same grid as the module gallery on the staff homepage: two up on a
            phone, four across on a desktop. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <DashboardCard
            to="/my-lessons"
            icon={BookOpenIcon}
            title="My lessons"
            description={lessonsLine}
            badge={
              locked
                ? "Bloqueado"
                : lessons
                  ? `${lessons} ${lessons === 1 ? "aula" : "aulas"}`
                  : undefined
            }
          />
          <DashboardCard
            to="/my-homework"
            icon={NotebookPenIcon}
            title="My homework"
            description={homeworkLine}
            badge={todo > 0 ? `${todo} a fazer` : undefined}
          />
          <DashboardCard
            to="/my-context"
            icon={SparklesIcon}
            title="My context"
            description="Para o Advanced Context "
          />
          <DashboardCard
            to="/practice"
            icon={DumbbellIcon}
            title="Practice"
            description="Leitura e compreensão"
          />
        </div>
      </main>
    </div>
  );
}
