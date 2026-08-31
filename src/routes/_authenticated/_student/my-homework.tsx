import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { NotebookPenIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCard } from "@/features/learn/components/book-card";
import { StudentListCard } from "@/features/learn/components/student-list-card";
import {
  listMySubmissions,
  listStudentHomework,
  type StudentHomework,
  type StudentSubmission,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/my-homework")({
  component: MyHomeworkPage,
});

/** The one-word state of a homework, from the student's point of view. */
function StatusBadge({ submission }: { submission?: StudentSubmission }) {
  if (!submission) {
    return <Badge variant="secondary">A fazer</Badge>;
  }
  if (submission.status === "in_progress") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Começado
      </Badge>
    );
  }
  if (submission.status === "submitted") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Entregue
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
    >
      {submission.score !== null ? `${submission.score}/10` : "Corrigido"}
    </Badge>
  );
}

function MyHomeworkPage() {
  const { access } = Route.useRouteContext();

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

  // Anything not yet handed in is still theirs to do — a submission left in
  // progress counts exactly like one never started.
  const todo = homework.filter((task) => {
    const submission = submissions.get(task.id);
    return !submission || submission.status === "in_progress";
  }).length;

  const meta =
    status !== "ready"
      ? undefined
      : homework.length === 0
        ? "Nada passado ainda"
        : todo > 0
          ? `${homework.length} ${homework.length === 1 ? "tarefa" : "tarefas"} · ${todo} a fazer`
          : `${homework.length} ${homework.length === 1 ? "tarefa" : "tarefas"} · você está em dia`;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to home" align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <BookCard
          icon={NotebookPenIcon}
          eyebrow="Minhas tarefas"
          title={access.moduleName ?? "Sem módulo"}
          meta={meta}
        />

        {status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border text-center">
            <p className="font-montserrat text-sm text-muted-foreground">
              Não foi possível carregar suas tarefas.
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
              Tentar de novo
            </Button>
          </div>
        ) : homework.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 font-montserrat text-sm text-muted-foreground">
            Nada por aqui ainda. Quando seu professor publicar uma tarefa do seu
            módulo, ela aparece aqui.
          </div>
        ) : (
          <div className="space-y-3">
            {homework.map((task, i) => (
              <StudentListCard
                key={task.id}
                to="/homework/$homeworkId"
                params={{ homeworkId: task.id }}
                index={i + 1}
                title={task.title || task.id}
                subtitle={task.lessonTitle || undefined}
                badge={<StatusBadge submission={submissions.get(task.id)} />}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
