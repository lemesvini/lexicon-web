import { MessageSquareQuoteIcon } from "lucide-react";

import type { AnswerValue, Lesson, LessonBlock } from "@/lib/lessons";
import {
  BLOCK_REGISTRY,
  BlockView,
  type BlockAnswerProps,
} from "@/features/blocks";
import { cn } from "@/lib/utils";

/**
 * A homework, rendered to be answered.
 *
 * The counterpart to DocumentView: same walk over the document, but a block that
 * declares an `Answer` component is rendered through that instead of through its
 * read-only `View`. That is the whole distinction between an exercise and a
 * piece of prose, and it lives in the block's own definition rather than in a
 * list of types kept somewhere else.
 *
 * One block card serves every moment — answering, handed in, corrected — and
 * every surface: the student's stepper takes one at a time, this list takes all
 * of them, and the teacher's correction screen takes the list with a note editor
 * slotted in. Which one is decided entirely by props, so there is one layout
 * rather than three that drift.
 */

/** One block, with the numbering the student sees. */
export type ExerciseItem = {
  block: LessonBlock;
  /** The block's stable id; empty for a block that carries none. */
  id: string;
  answerable: boolean;
  /** 1-based among answerable blocks only, null for prose. */
  number: number | null;
};

/**
 * Flattens a homework's slides into the list of blocks to work through.
 *
 * Only answerable blocks are numbered — calling a passage the student is merely
 * meant to read "question 3" would be misleading.
 */
export function exerciseItems(document: Lesson): ExerciseItem[] {
  const blocks = (document.slides ?? []).flatMap((slide) => slide.blocks ?? []);
  const answerable = blocks.map(
    (block) => BLOCK_REGISTRY[block.type].Answer !== undefined,
  );

  return blocks.map((block, i) => ({
    block,
    id: "id" in block ? block.id : "",
    answerable: answerable[i],
    number: answerable[i]
      ? answerable.slice(0, i + 1).filter(Boolean).length
      : null,
  }));
}

/** How many of a homework's questions have an answer recorded. */
export function answeredCount(
  items: ExerciseItem[],
  answers: Record<string, AnswerValue>,
): number {
  return items.filter((item) => item.answerable && isAnswered(item, answers))
    .length;
}

export function isAnswered(
  item: ExerciseItem,
  answers: Record<string, AnswerValue>,
): boolean {
  if (!item.answerable || !item.id) return false;
  const value = answers[item.id];
  if (value === undefined) return false;
  // A written answer of only whitespace is not an answer.
  return typeof value === "string" ? value.trim() !== "" : true;
}

export type ExerciseBlockProps = {
  item: ExerciseItem;
  answers: Record<string, AnswerValue>;
  onAnswer?: (blockId: string, value: AnswerValue) => void;
  disabled?: boolean;
  marks?: Record<string, boolean>;
  answerKey?: Record<string, AnswerValue>;
  blockNotes?: Record<string, string>;
  /** Replaces the read-only note under the block. The correction screen passes
   *  an editor here, so the teacher writes their remarks in the same layout the
   *  student reads them in. */
  noteSlot?: (blockId: string) => React.ReactNode;
  className?: string;
};

export function ExerciseBlockCard({
  item,
  answers,
  onAnswer,
  disabled = false,
  marks = {},
  answerKey = {},
  blockNotes = {},
  noteSlot,
  className,
}: ExerciseBlockProps) {
  const { block, id, answerable, number } = item;
  const note = id ? blockNotes[id] : undefined;
  const mark = id && id in marks ? marks[id] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        mark === true && "border-emerald-500/40",
        mark === false && "border-destructive/40",
        className,
      )}
    >
      {answerable && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Question {number}
        </p>
      )}

      {answerable && id ? (
        <AnswerSlot
          block={block}
          value={answers[id]}
          onChange={(value) => onAnswer?.(id, value)}
          disabled={disabled || !onAnswer}
          mark={mark}
          correct={id in answerKey ? answerKey[id] : null}
        />
      ) : (
        <BlockView block={block} audience="student" />
      )}

      {noteSlot && id ? (
        <div className="mt-5">{noteSlot(id)}</div>
      ) : (
        note && (
          <div className="mt-5 flex gap-2.5 rounded-xl bg-muted/60 px-4 py-3">
            <MessageSquareQuoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="whitespace-pre-line text-sm leading-relaxed">{note}</p>
          </div>
        )
      )}
    </div>
  );
}

/** Every block at once — how a finished homework is read back, and how the
 *  teacher marks one. */
export function ExerciseView({
  document,
  ...props
}: { document: Lesson } & Omit<ExerciseBlockProps, "item" | "className">) {
  const items = exerciseItems(document);

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        This homework has no questions yet.
      </div>
    );
  }

  return (
    <ol className="space-y-8">
      {items.map((item, i) => (
        <li key={item.id || i}>
          <ExerciseBlockCard item={item} {...props} />
        </li>
      ))}
    </ol>
  );
}

/** Dispatches to the block's own Answer component, erasing the discriminated
 *  union in one controlled place — the runtime `block.type` guarantees the
 *  match, exactly as BlockView does for the read-only side. */
function AnswerSlot({
  block,
  ...props
}: { block: LessonBlock } & Omit<BlockAnswerProps<LessonBlock>, "block">) {
  const Answer = BLOCK_REGISTRY[block.type].Answer as
    | React.FC<BlockAnswerProps<LessonBlock>>
    | undefined;

  if (!Answer) return <BlockView block={block} audience="student" />;
  return <Answer block={block} {...props} />;
}
