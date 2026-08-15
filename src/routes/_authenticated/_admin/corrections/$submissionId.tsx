import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseView } from "@/features/learn/components/exercise-view";
import {
  fetchSubmission,
  gradeSubmission,
  reopenSubmission,
  type SubmissionDetail,
} from "@/features/corrections/data/submissions";

export const Route = createFileRoute(
  "/_authenticated/_admin/corrections/$submissionId",
)({ component: CorrectionRoute });

function CorrectionRoute() {
  const { submissionId } = Route.useParams();
  return <Correction key={submissionId} submissionId={submissionId} />;
}

/**
 * One submission, marked.
 *
 * The teacher reads it through the same `ExerciseView` the student answered it
 * in — with the marking switched on and a note field under each question. Two
 * separate layouts for the same document would have drifted the first time a
 * block changed.
 */
function Correction({ submissionId }: { submissionId: string }) {
  const navigate = useNavigate();

  const [phase, setPhase] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [detail, setDetail] = React.useState<SubmissionDetail | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  // Shown verbatim on failure. These are admin screens, and a Postgres or
  // PostgREST message says what went wrong far better than "something did".
  const [failure, setFailure] = React.useState("");

  // The correction in progress. Seeded from the row so re-opening a marked
  // submission shows what was said last time rather than a blank form.
  const [score, setScore] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<"grading" | "reopening" | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetchSubmission(submissionId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setPhase("missing");
          return;
        }
        setDetail(row);
        setScore(row.score === null ? "" : String(row.score));
        setFeedback(row.feedback);
        setNotes(row.blockNotes);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure((err as Error).message ?? "");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [submissionId, reloadKey]);

  const parsedScore = score.trim() === "" ? null : Number(score);
  const scoreValid =
    parsedScore === null ||
    (Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 10);

  const grade = async () => {
    if (!scoreValid) return;
    setBusy("grading");
    try {
      await gradeSubmission(submissionId, {
        score: parsedScore,
        feedback,
        // Blank notes are dropped rather than stored as empty strings, so the
        // student's page doesn't render an empty remark box under a question.
        blockNotes: Object.fromEntries(
          Object.entries(notes).filter(([, v]) => v.trim() !== ""),
        ),
      });
      await navigate({ to: "/corrections" });
    } catch (err) {
      alert((err as Error).message);
      setBusy(null);
    }
  };

  const reopen = async () => {
    setBusy("reopening");
    try {
      await reopenSubmission(submissionId);
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/corrections" backLabel="Back to corrections" align="narrow" />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-24 pt-4">
        {phase === "loading" ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : phase === "missing" ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            That submission no longer exists.
          </div>
        ) : phase === "error" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load this submission.
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
                setPhase("loading");
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCwIcon />
              Try again
            </Button>
          </div>
        ) : (
          detail && (
            <>
              <header className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {[detail.homeworkTitle, detail.lessonTitle, detail.module]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {detail.studentName}
                  </h1>
                  {detail.status === "graded" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Already corrected
                    </Badge>
                  )}
                  {detail.status === "in_progress" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Still being worked on
                    </Badge>
                  )}
                </div>
              </header>

              <ExerciseView
                document={detail.document}
                answers={detail.answers}
                disabled
                marks={detail.marks}
                answerKey={detail.answerKey}
                noteSlot={(blockId) => (
                  <textarea
                    value={notes[blockId] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [blockId]: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="A note on this question (optional)…"
                    className="w-full rounded-xl border bg-muted/30 px-4 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
                  />
                )}
              />

              <section className="space-y-4 rounded-2xl border p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mark
                    </span>
                    <div className="flex items-baseline gap-1">
                      <input
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        className="w-20 rounded-md border bg-background px-3 py-1.5 text-lg tabular-nums outline-none focus:ring-2 focus:ring-ring/30"
                      />
                      <span className="text-muted-foreground">/ 10</span>
                    </div>
                  </label>

                  {!scoreValid && (
                    <p className="text-sm text-destructive">
                      Give a number between 0 and 10, or leave it blank.
                    </p>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Overall comment
                  </span>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    placeholder="What they did well, and what to work on…"
                    className="w-full rounded-xl border bg-background px-4 py-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  {detail.status === "graded" && (
                    <Button
                      variant="outline"
                      onClick={() => void reopen()}
                      disabled={busy !== null}
                    >
                      {busy === "reopening" ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <RotateCcwIcon />
                      )}
                      Hand back for another go
                    </Button>
                  )}
                  <Button
                    onClick={() => void grade()}
                    disabled={busy !== null || !scoreValid}
                  >
                    {busy === "grading" ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <CheckIcon />
                    )}
                    {detail.status === "graded"
                      ? "Save the correction"
                      : "Release the correction"}
                  </Button>
                </div>

                <p className="text-right text-xs text-muted-foreground">
                  The mark, the comment and every note are released to the
                  student together, the moment this is saved.
                </p>
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
