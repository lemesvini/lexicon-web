import * as React from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudAlertIcon,
  Loader2Icon,
  SendIcon,
} from "lucide-react";

import type { AnswerValue, Lesson } from "@/lib/lessons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ExerciseBlockCard,
  answeredCount,
  exerciseItems,
  isAnswered,
} from "./exercise-view";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * A homework, one question at a time.
 *
 * The whole list at once turned every homework into a wall — you couldn't tell
 * how much was left without scrolling to the bottom, and there was nothing to
 * finish. One card at a time with a bar above it answers "how far in am I?"
 * without being asked.
 *
 * Progress measures answers, not position: walking to the end without answering
 * anything should not read as being done. The dots below the bar are the
 * navigation, so a student can jump back to the one they skipped instead of
 * clicking Back four times.
 */
export function ExerciseStepper({
  document,
  answers,
  onAnswer,
  onSubmit,
  saveState,
  submitting,
}: {
  document: Lesson;
  answers: Record<string, AnswerValue>;
  onAnswer: (blockId: string, value: AnswerValue) => void;
  onSubmit: () => void;
  saveState: SaveState;
  submitting: boolean;
}) {
  const items = React.useMemo(() => exerciseItems(document), [document]);
  const [step, setStep] = React.useState(0);

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        This homework has no questions yet.
      </div>
    );
  }

  // Clamped rather than stored blindly: a homework edited between sessions can
  // come back shorter than the step someone left off on.
  const current = Math.min(step, items.length - 1);
  const item = items[current];

  const total = items.filter((i) => i.answerable).length;
  const done = answeredCount(items, answers);
  const isLast = current === items.length - 1;

  return (
    <div className="space-y-6">
      <Progress done={done} total={total} saveState={saveState} />

      <Dots
        items={items}
        answers={answers}
        current={current}
        onGo={(i) => setStep(i)}
      />

      <ExerciseBlockCard
        // Keyed so moving between questions remounts the card — otherwise a
        // textarea keeps the previous question's scroll position and cursor.
        key={item.id || current}
        item={item}
        answers={answers}
        onAnswer={onAnswer}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep(current - 1)}
          disabled={current === 0}
        >
          <ChevronLeftIcon />
          Back
        </Button>

        <span className="text-sm text-muted-foreground tabular-nums">
          {current + 1} / {items.length}
        </span>

        {isLast ? (
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
            Hand in
          </Button>
        ) : (
          <Button onClick={() => setStep(current + 1)}>
            Next
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function Progress({
  done,
  total,
  saveState,
}: {
  done: number;
  total: number;
  saveState: SaveState;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-2">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Questions answered"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {done} of {total} answered
        </span>
        <SaveIndicator state={saveState} />
      </div>
    </div>
  );
}

/** Quiet by design: autosave that announces itself constantly is noise, so only
 *  the two states worth acting on say anything at all. */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CheckIcon className="size-3" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <CloudAlertIcon className="size-3" />
        Not saved — check your connection
      </span>
    );
  }
  return null;
}

function Dots({
  items,
  answers,
  current,
  onGo,
}: {
  items: ReturnType<typeof exerciseItems>;
  answers: Record<string, AnswerValue>;
  current: number;
  onGo: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => {
        const answered = isAnswered(item, answers);
        return (
          <button
            key={item.id || i}
            type="button"
            onClick={() => onGo(i)}
            aria-label={
              item.number ? `Question ${item.number}` : `Step ${i + 1}`
            }
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "size-8 rounded-lg border text-xs font-medium tabular-nums transition-colors",
              answered
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
              i === current && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
          >
            {item.number ?? "·"}
          </button>
        );
      })}
    </div>
  );
}
