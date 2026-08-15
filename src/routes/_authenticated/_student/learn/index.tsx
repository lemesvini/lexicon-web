import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeworkCta } from "@/features/learn/components/homework-cta";
import {
  listMySubmissions,
  listStudentHomework,
  listStudentLessons,
  type StudentHomework,
  type StudentLessonSummary,
  type StudentSubmission,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/learn/")({
  component: LearnPage,
});

/**
 * The student's homepage: the module they've been given, and its lessons.
 *
 * Nothing is filtered here — `student_lessons` is a view scoped to the caller's
 * module and to published material (see 0004), so what comes back is exactly
 * what they're allowed to read. A lesson whose material is still a draft is
 * absent, not greyed out.
 */
function LearnPage() {
  const { access } = Route.useRouteContext();

  const [lessons, setLessons] = React.useState<StudentLessonSummary[]>([]);
  const [homework, setHomework] = React.useState<StudentHomework[]>([]);
  const [submissions, setSubmissions] = React.useState<
    Map<string, StudentSubmission>
  >(new Map());
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      listStudentLessons(),
      listStudentHomework(),
      listMySubmissions(),
    ])
      .then(([lessonRows, homeworkRows, mine]) => {
        if (cancelled) return;
        setLessons(lessonRows);
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
  }, [reloadKey]);

  const refresh = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <div>
          <p className="font-display text-3xl tracking-wide text-foreground">
            Hello {access.fullName.split(" ")[0] || "there"}!
          </p>
          <span className="text-sm text-muted-foreground">
            Access your classes and homeworks here
          </span>
        </div>


        {/* Above the lessons, below the greeting: what's owed comes before what
            there is to read, but not before being said hello to. */}
        {status === "ready" && (
          <HomeworkCta homework={homework} submissions={submissions} />
        )}
        <div className="space-y-1">
          {/* <p className="text-sm text-muted-foreground">
            Hi {access.fullName.split(" ")[0] || "there"} — your module
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {access.moduleName ?? "No module yet"}
          </h1> */}
          <h1 className="text-xl font-bold">
            {access.moduleName ?? "not assigned yet"}
          </h1>
        </div>
        {!access.moduleName ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            Your teacher hasn’t assigned you a module yet. Once they do, its
            lessons show up here.
          </div>
        ) : status === "loading" ? (
          <div className="space-y-px overflow-hidden rounded-md border p-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
            <p className="text-sm text-muted-foreground">
              Couldn’t load your lessons.
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCwIcon />
              Try again
            </Button>
          </div>
        ) : lessons.length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            No lessons in this module yet.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-md border">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  to="/learn/$lessonId"
                  params={{ lessonId: lesson.id }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {lesson.title || lesson.id}
                    </span>
                    {lesson.unit && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {lesson.unit}
                      </span>
                    )}
                  </span>

                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
