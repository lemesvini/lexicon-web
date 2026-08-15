import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listMySubmissions,
  listStudentHomework,
  type StudentHomework,
  type StudentSubmission,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/homework/")({
  component: HomeworkListPage,
});

/** The one-word state of a homework, from the student's point of view. */
function StatusBadge({ submission }: { submission?: StudentSubmission }) {
  if (!submission) {
    return <Badge variant="secondary">To do</Badge>;
  }
  if (submission.status === "in_progress") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Started
      </Badge>
    );
  }
  if (submission.status === "submitted") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Handed in
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300">
      {submission.score !== null ? `${submission.score}/10` : "Marked"}
    </Badge>
  );
}

function HomeworkListPage() {
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
    Promise.all([listStudentHomework(), listMySubmissions()])
      .then(([rows, mine]) => {
        if (cancelled) return;
        setHomework(rows);
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

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to my module" align="narrow" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Homework</h1>
          <p className="text-sm text-muted-foreground">
            Everything set for your module, and where each one stands.
          </p>
        </div>

        {status === "loading" ? (
          <div className="space-y-px overflow-hidden rounded-md border p-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load your homework.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("loading");
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCwIcon />
              Try again
            </Button>
          </div>
        ) : homework.length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            Nothing set yet. When your teacher publishes homework for your
            module, it shows up here.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-md border">
            {homework.map((task) => (
              <li key={task.id}>
                <Link
                  to="/homework/$homeworkId"
                  params={{ homeworkId: task.id }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {task.title || task.id}
                    </span>
                    {task.lessonTitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.lessonTitle}
                      </span>
                    )}
                  </span>

                  <StatusBadge submission={submissions.get(task.id)} />
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
