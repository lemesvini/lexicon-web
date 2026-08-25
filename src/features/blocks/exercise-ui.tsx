import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared presentation for the exercise blocks. Three blocks with three
// different prompts, but the same vocabulary of states underneath — chosen,
// right, wrong, revealed — and it should read as one thing to the student.

/** How an option is currently standing. */
export type OptionState =
  | "idle"
  | "chosen"
  /** Chosen and right, or revealed as the right one after grading. */
  | "correct"
  /** Chosen and wrong. */
  | "incorrect";

export function optionState({
  index,
  chosen,
  correct,
  revealed,
}: {
  index: number;
  chosen: number | null;
  /** The right answer, or null while it is still withheld. */
  correct: number | null;
  /** True once the work has been graded and the key released. */
  revealed: boolean;
}): OptionState {
  if (revealed && correct !== null && index === correct) return "correct";
  if (index !== chosen) return "idle";
  if (!revealed || correct === null) return "chosen";
  return index === correct ? "correct" : "incorrect";
}

const OPTION_CLASS: Record<OptionState, string> = {
  idle: "border-border bg-background hover:border-primary/40 hover:bg-accent",
  chosen: "border-primary bg-primary/10 text-foreground",
  correct:
    "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  incorrect:
    "border-destructive/60 bg-destructive/10 text-destructive",
};

/** One tappable answer. Renders as a plain div when there is nothing to tap —
 *  a disabled button still reads as a control to a screen reader. */
export function OptionButton({
  state,
  disabled,
  onClick,
  children,
  className,
}: {
  state: OptionState;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1">{children}</span>
      {state === "correct" && <CheckIcon className="size-4 shrink-0" />}
      {state === "incorrect" && <XIcon className="size-4 shrink-0" />}
    </>
  );

  const shared = cn(
    "flex w-full items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-left text-base transition-colors",
    OPTION_CLASS[state],
    className,
  );

  if (disabled) {
    return <div className={cn(shared, "cursor-default")}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={shared}>
      {content}
    </button>
  );
}

/**
 * The gap in a sentence: empty, or filled with the word the student picked.
 *
 * There is no way to empty it again once filled, and that is deliberate — the
 * alternative was a magic "unanswered" value living in the stored answer format
 * forever. Picking a different option replaces this one, which is the gesture
 * people already expect here.
 *
 * The placeholder text is real (and invisible) rather than a fixed width, so the
 * gap is the size of a word in the reader's own font and doesn't jump when
 * filled.
 */
export function SentenceSlot({
  word,
  state,
}: {
  word: string | null;
  state: OptionState;
}) {
  const filled = word !== null;

  return (
    <span
      className={cn(
        "mx-1 inline-flex min-w-24 items-center justify-center rounded-lg border-b-2 px-3 py-0.5 align-baseline font-medium",
        !filled && "border-dashed border-muted-foreground/50 text-transparent",
        filled && state === "chosen" && "border-primary bg-primary/10",
        filled &&
          state === "correct" &&
          "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        filled &&
          state === "incorrect" &&
          "border-destructive bg-destructive/10 text-destructive",
      )}
    >
      {filled ? word : "placeholder"}
    </span>
  );
}

/**
 * One word of a sentence, tappable — the `find-mistake` counterpart to
 * OptionButton, sharing its state vocabulary so a right answer is the same
 * green wherever a student meets one.
 *
 * Idle is drawn borderless: a sentence where every word already wears a box is
 * a list of words, and the student is meant to read it as a sentence first. The
 * border is held (transparent) rather than added on hover so nothing reflows
 * under the cursor.
 */
const WORD_CLASS: Record<OptionState, string> = {
  idle: "border-transparent hover:border-primary/40 hover:bg-accent",
  chosen: "border-primary bg-primary/10",
  correct:
    "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  incorrect: "border-destructive/60 bg-destructive/10 text-destructive",
};

export function WordChip({
  state,
  disabled,
  onClick,
  children,
}: {
  state: OptionState;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const shared = cn(
    "rounded-lg border-2 px-1.5 py-0.5 transition-colors",
    WORD_CLASS[state],
  );

  if (disabled) {
    return <span className={cn(shared, "cursor-default")}>{children}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={shared}>
      {children}
    </button>
  );
}

/** Marks the right option in the teacher's own views. */
export function AnswerKeyMark({ isAnswer }: { isAnswer: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
        isAnswer
          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "border-border text-transparent",
      )}
      aria-label={isAnswer ? "Correct answer" : undefined}
    >
      <CheckIcon className="size-3" />
    </span>
  );
}
