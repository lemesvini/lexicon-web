import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/lib/student-content";
import { cn } from "@/lib/utils";
import type {
  StudentSubmission,
  StudentSummary,
} from "@/features/students/data/student-profile";
import {
  formatDateTime,
  formatMark,
} from "@/features/students/components/student-formats";
import {
  StudentPanel,
  StudentPanelEmpty,
  type PanelSlotProps,
} from "@/features/students/components/student-panel";

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  in_progress: "Started",
  submitted: "To correct",
  graded: "Corrected",
};

/** Only "To correct" carries colour — it is the one that is a call to do
 *  something, and a list where everything is highlighted highlights nothing. */
function StatusBadge({ status }: { status: SubmissionStatus }) {
  if (status === "submitted") {
    return <Badge variant="secondary">{STATUS_LABEL.submitted}</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/**
 * Every mark this student has been given, oldest to newest, against their own
 * average.
 *
 * Bars rather than a line: the marks are separate pieces of work, not samples of
 * one continuous thing, and there is nothing meaningful between two of them. The
 * scale is fixed at 0–10 rather than fitted to the data, so a run of eights
 * doesn't redraw itself into a dramatic slope.
 */
function MarksChart({
  marks,
  average,
}: {
  /** Oldest first — the order the chart reads in. */
  marks: StudentSubmission[];
  average: number;
}) {
  return (
    <div className="space-y-2">
      <div className="relative flex h-28 items-end gap-1">
        {/* The average, drawn across the bars. Positioned from the bottom on the
            same 0–10 scale they use, so the two always agree. */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
          style={{ bottom: `${(average / 10) * 100}%` }}
          aria-hidden
        />
        {marks.map((submission) => {
          const score = submission.score ?? 0;
          return (
            <div
              key={submission.id}
              className="flex h-full flex-1 flex-col justify-end"
              // The native tooltip is enough here: the chart is a glance, and
              // the same numbers are spelled out in the list underneath.
              title={`${submission.homeworkTitle} — ${formatMark(score)}/10`}
            >
              <div
                className={cn(
                  "w-full rounded-t-sm transition-colors",
                  // Below halfway is a fail in any marking scheme this app is
                  // likely to meet, and is the one thing worth spotting.
                  score < 5 ? "bg-destructive/60" : "bg-primary/80",
                )}
                style={{ height: `${Math.max((score / 10) * 100, 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {marks.length} mark{marks.length === 1 ? "" : "s"}, oldest first. The
        dashed line is their average, {formatMark(average)}/10.
      </p>
    </div>
  );
}

/**
 * Everything this student has been set and touched: the marks they've been
 * given, then the work itself, newest first.
 *
 * Homework only opened is listed alongside what was handed in. A student who
 * starts everything and finishes nothing looks identical to one who was never
 * set anything if you only count submissions, and the difference is the whole
 * reason to open this page.
 *
 * Each row opens the marking screen, which is where anything about a submission
 * is actually done — this panel is the index into it, not a second copy.
 */
export function StudentHomeworkPanel({
  submissions,
  summary,
  ...slot
}: {
  /** Newest first, as `fetchStudentDossier` returns them. */
  submissions: StudentSubmission[];
  summary: StudentSummary;
} & PanelSlotProps) {
  // The chart reads left to right in time, which is the reverse of the list.
  const marks = submissions
    .filter((submission) => submission.status === "graded" && submission.score !== null)
    .slice()
    .reverse();

  return (
    <StudentPanel
      {...slot}
      title="Homework"
      meta={
        summary.totalSubmissions === 0
          ? "Nothing set yet"
          : [
              `${summary.totalSubmissions} in total`,
              summary.awaitingCount > 0 &&
                `${summary.awaitingCount} waiting on you`,
              summary.startedCount > 0 && `${summary.startedCount} still open`,
            ]
              .filter(Boolean)
              .join(" · ")
      }
    >
      {marks.length > 0 && (
        <div className="border-b px-5 py-4">
          <MarksChart marks={marks} average={summary.averageScore ?? 0} />
        </div>
      )}

      {submissions.length === 0 ? (
        <StudentPanelEmpty>
          They haven’t opened any homework yet. Publish one against a lesson in
          their module and it will show up here.
        </StudentPanelEmpty>
      ) : (
        <ul className="divide-y">
          {submissions.map((submission) => {
            const context = [submission.lessonTitle, submission.module]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={submission.id}>
                <Link
                  to="/corrections/$submissionId"
                  params={{ submissionId: submission.id }}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-medium">
                      {submission.homeworkTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        context,
                        submission.submittedAt
                          ? `handed in ${formatDateTime(submission.submittedAt)}`
                          : "not handed in",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <StatusBadge status={submission.status} />

                  <span className="w-14 text-right tabular-nums">
                    {submission.score === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {formatMark(submission.score)}
                        </span>
                        <span className="text-muted-foreground">/10</span>
                      </>
                    )}
                  </span>

                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </StudentPanel>
  );
}
