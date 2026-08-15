import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import type { AnswerValue } from "@/lib/lessons";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseStepper } from "@/features/learn/components/exercise-stepper";
import {
  ExerciseView,
  answeredCount,
  exerciseItems,
} from "@/features/learn/components/exercise-view";
import { useAutosave } from "@/features/learn/use-autosave";
import {
  fetchMySubmission,
  fetchStudentHomework,
  submitMyAnswers,
  type StudentHomework,
  type StudentSubmission,
} from "@/lib/student-content";

export const Route = createFileRoute(
  "/_authenticated/_student/homework/$homeworkId",
)({ component: HomeworkPageRoute });

function HomeworkPageRoute() {
  const { homeworkId } = Route.useParams();
  return <HomeworkPage key={homeworkId} homeworkId={homeworkId} />;
}

type Loaded = {
  homework: StudentHomework;
  submission: StudentSubmission | null;
};

/**
 * One homework, in the two shapes it takes.
 *
 * While it is being answered, it is a stepper: one question on screen, a bar
 * above it, saved as they go. Once handed in it becomes the whole list at once —
 * reading back a correction means scanning for what went wrong, which is the
 * opposite of what a stepper is good at.
 */
function HomeworkPage({ homeworkId }: { homeworkId: string }) {
  const [phase, setPhase] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({});
  const [dirty, setDirty] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchStudentHomework(homeworkId),
      fetchMySubmission(homeworkId),
    ])
      .then(([homework, submission]) => {
        if (cancelled) return;
        if (!homework) {
          setPhase("missing");
          return;
        }
        setLoaded({ homework, submission });
        setAnswers(submission?.answers ?? {});
        setDirty(false);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [homeworkId, reloadKey]);

  const submission = loaded?.submission ?? null;
  const status = submission?.status ?? "in_progress";
  const answering = status === "in_progress";

  const saveState = useAutosave({
    homeworkId,
    answers,
    dirty,
    enabled: answering,
  });

  const setAnswer = (blockId: string, value: AnswerValue) => {
    setDirty(true);
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
  };

  const submit = async () => {
    const items = exerciseItems(loaded?.homework.document ?? emptyDocument);
    const total = items.filter((i) => i.answerable).length;
    const blank = total - answeredCount(items, answers);

    const warning =
      blank > 0
        ? `${blank} question${blank === 1 ? " is" : "s are"} still blank. Hand it in anyway? You won't be able to change your answers afterwards.`
        : "Hand this in? You won't be able to change your answers afterwards.";

    if (!window.confirm(warning)) return;

    setSubmitting(true);
    try {
      // The full set goes with the submit, so a pending autosave being in
      // flight (or never having fired) can't cost an answer.
      await submitMyAnswers(homeworkId, answers);
      // Reload rather than patching state locally: the server decides what a
      // handed-in submission looks like, and it withholds the marking.
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/homework" backLabel="Back to homework" align="narrow" />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-24 pt-4">
        {phase === "loading" ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : phase === "missing" ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            This homework isn't available to you.
          </div>
        ) : phase === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load this homework.
            </p>
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
          loaded && (
            <>
              <header className="space-y-2">
                {loaded.homework.lessonTitle && (
                  <p className="text-sm text-muted-foreground">
                    {loaded.homework.lessonTitle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {loaded.homework.title || loaded.homework.id}
                  </h1>
                  {status === "submitted" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Handed in — waiting to be marked
                    </Badge>
                  )}
                </div>
                {loaded.homework.document.context && (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {loaded.homework.document.context}
                  </p>
                )}
              </header>

              {status === "graded" && submission && (
                <Result submission={submission} />
              )}

              {answering ? (
                <ExerciseStepper
                  document={loaded.homework.document}
                  answers={answers}
                  onAnswer={setAnswer}
                  onSubmit={() => void submit()}
                  saveState={saveState}
                  submitting={submitting}
                />
              ) : (
                <ExerciseView
                  document={loaded.homework.document}
                  answers={answers}
                  disabled
                  marks={submission?.marks}
                  answerKey={submission?.answerKey}
                  blockNotes={submission?.blockNotes}
                />
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}

/** Stands in while the document is still loading, so the submit guard has
 *  something of the right shape to count. */
const emptyDocument = {
  id: "",
  unit: "",
  module: "",
  title: "",
  context: "",
  minorCanDo: "",
  grammarFocus: [],
  classPlan: [],
  slides: [],
};

/** The mark, once the teacher is done with it. */
function Result({ submission }: { submission: StudentSubmission }) {
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          {submission.score !== null ? submission.score : "—"}
          <span className="text-lg text-muted-foreground">/10</span>
        </span>
        <span className="text-sm text-muted-foreground">Marked</span>
      </div>

      {submission.feedback && (
        <p className="whitespace-pre-line leading-relaxed">
          {submission.feedback}
        </p>
      )}
    </section>
  );
}
