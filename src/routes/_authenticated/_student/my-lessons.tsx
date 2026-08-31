import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCard } from "@/features/learn/components/book-card";
import { StudentListCard } from "@/features/learn/components/student-list-card";
import {
  listStudentSyllabus,
  type StudentSyllabusEntry,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/my-lessons")({
  component: MyLessonsPage,
});

/**
 * The module the student has been given, and its lessons — the book, then what
 * is in it.
 *
 * The whole syllabus, not just what is open: a lesson whose material hasn't
 * been published is listed, greyed and unclickable, and counted in the total.
 * A course that appears one lesson at a time tells a student nothing about how
 * much of it is left. Reading one is still refused by `student_lessons` — see
 * `listStudentSyllabus`, and 0020.
 */
function MyLessonsPage() {
  const { access } = Route.useRouteContext();

  const [lessons, setLessons] = React.useState<StudentSyllabusEntry[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    listStudentSyllabus()
      .then((rows) => {
        if (cancelled) return;
        setLessons(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // The lessons stay shut until the onboarding is answered — the answers are
  // what the lessons get built around, so reading them first is backwards.
  const locked = !access.onboardedAt;

  const refresh = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const meta = locked
    ? "Bloqueado até o onboarding"
    : status === "ready"
      ? `${lessons.length} ${lessons.length === 1 ? "aula" : "aulas"}`
      : undefined;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to home" align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <BookCard
          icon={BookOpenIcon}
          eyebrow="Meu módulo"
          title={access.moduleName ?? "Sem módulo"}
          meta={meta}
        />

        {locked ? (
          <EmptyCard>Termine seu onboarding para liberar as aulas.</EmptyCard>
        ) : !access.moduleName ? (
          <EmptyCard>
            Seu professor ainda não atribuiu um módulo. Assim que atribuir, as
            aulas aparecem aqui.
          </EmptyCard>
        ) : status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border text-center">
            <p className="font-montserrat text-sm text-muted-foreground">
              Não foi possível carregar suas aulas.
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCwIcon />
              Tentar de novo
            </Button>
          </div>
        ) : lessons.length === 0 ? (
          <EmptyCard>Nenhuma aula neste módulo ainda.</EmptyCard>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, i) => (
              <StudentListCard
                key={lesson.id}
                to="/learn/$lessonId"
                params={{ lessonId: lesson.id }}
                index={i + 1}
                title={lesson.title || lesson.id}
                subtitle={lesson.unit || undefined}
                disabled={!lesson.available}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** Nothing to list, said on the same card as everything else on the page. */
function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 font-montserrat text-sm text-muted-foreground">
      {children}
    </div>
  );
}
