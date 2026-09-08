import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { submissionsColumns } from "@/features/corrections/components/submissions-columns";
import {
  listSubmissions,
  type SubmissionRow,
} from "@/features/corrections/data/submissions";

export const Route = createFileRoute("/_authenticated/_admin/corrections/")({
  component: CorrectionsPage,
});

/**
 * The marking queue: everything students have handed in, oldest first.
 *
 * A page of its own rather than a tab under each homework, because the question
 * this answers is "what is waiting on me?" — which nobody can ask one homework
 * at a time.
 *
 * A teacher gets their own students and nothing else — that is the RLS in 0006,
 * not a filter here. The admin gets everyone, so they also get a teacher facet,
 * opened on themselves: the admin teaches too, and the queue they came to read
 * is almost always their own.
 */
function CorrectionsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = React.useState<SubmissionRow[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [failure, setFailure] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    listSubmissions()
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure((err as Error).message ?? "");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // "Waiting on you" means your own students, so the admin's line counts theirs
  // rather than the whole school's — the table below is what shows the rest, and
  // clearing the teacher facet is how you go looking for it.
  const pending = rows.filter(
    (r) =>
      r.status === "submitted" && (!isAdmin || r.teacherId === profile?.id),
  ).length;
  const homeworkTitles = [
    ...new Set(rows.map((r) => r.homeworkTitle)),
  ].sort((a, b) => a.localeCompare(b));

  // The facet options come from the rows, not from the teacher list: a teacher
  // who has since been deactivated still has submissions sitting in this queue,
  // and a facet that couldn't select them would leave those rows unreachable.
  const teacherNames = [...new Set(rows.map((r) => r.teacher))].sort((a, b) =>
    a.localeCompare(b),
  );

  // Taken from a row rather than from `profile.fullName`, because the column
  // falls back to the email for a teacher with no name and a default matching no
  // row would open the queue empty. Cleared like any other facet to get the rest
  // back.
  const ownTeacherName = rows.find((r) => r.teacherId === profile?.id)?.teacher;
  const initialFilters =
    isAdmin && ownTeacherName
      ? [{ id: "teacher", value: [ownTeacherName] }]
      : [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Corrections</h1>
          <p className="text-sm text-muted-foreground">
            {status === "ready"
              ? pending === 0
                ? "Nothing waiting on you."
                : `${pending} waiting on you.`
              : "What your students have handed in."}
          </p>
        </div>

        {status === "loading" ? (
          <TableSkeleton />
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load the queue.
            </p>
            {failure && (
              <p className="max-w-lg font-mono text-xs text-destructive">
                {failure}
              </p>
            )}
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
        ) : (
          <DataTable
            columns={submissionsColumns({ isAdmin })}
            data={rows}
            filterColumn="studentName"
            filterPlaceholder="Filter by student..."
            initialFilters={initialFilters}
            facets={[
              {
                columnId: "status",
                label: "Status",
                options: ["To correct", "Started", "Corrected"],
                clearLabel: "All",
              },
              ...(isAdmin
                ? [
                    {
                      columnId: "teacher",
                      label: "Teacher",
                      options: teacherNames,
                      clearLabel: "All teachers",
                    },
                  ]
                : []),
              {
                columnId: "homeworkTitle",
                label: "Homework",
                options: homeworkTitles,
                clearLabel: "All homework",
              },
            ]}
            emptyMessage="Nothing handed in yet."
            countLabel={(n) => `${n} submission${n === 1 ? "" : "s"}`}
          />
        )}
      </main>
    </div>
  );
}
