import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
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
 */
function CorrectionsPage() {
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

  const pending = rows.filter((r) => r.status === "submitted").length;
  const homeworkTitles = [
    ...new Set(rows.map((r) => r.homeworkTitle)),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav />
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
            columns={submissionsColumns()}
            data={rows}
            filterColumn="studentName"
            filterPlaceholder="Filter by student..."
            facets={[
              {
                columnId: "status",
                label: "Status",
                options: ["To correct", "Started", "Corrected"],
                clearLabel: "All",
              },
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
