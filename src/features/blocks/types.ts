import type { LucideIcon } from "lucide-react";
import type { AnswerValue, LessonBlock } from "@/lib/lessons";

export type BlockType = LessonBlock["type"];

/** Which surface is viewing a slide. The projected display shows student-facing
 *  content only; the teacher's control device also sees teacher-only blocks
 *  (answer keys, profile cards) marked `audience: "teacher"`. */
export type Audience = "student" | "teacher";

/** Palette + chrome metadata for a block type. */
export type BlockMeta = {
  type: BlockType;
  label: string;
  hint: string;
  icon: LucideIcon;
};

export type BlockViewProps<T> = { block: T; audience: Audience };
export type BlockEditorProps<T> = {
  block: T;
  onChange: (next: T) => void;
};

/**
 * A block being answered — the third surface, alongside View and Editor, and the
 * only one a student interacts with.
 *
 * The same component serves answering, hand-in and correction: `disabled` stops
 * the input, `mark` colours it, and `correct` reveals the key. Every one of them
 * is absent while the student is still working, which is exactly the state the
 * server keeps them in until the teacher is done (see the `student_submissions`
 * view in 0005).
 */
export type BlockAnswerProps<T> = {
  block: T;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  /** Handed in, or being looked at by someone who isn't the author. */
  disabled?: boolean;
  /** Whether this answer was right. Null for anything marked by hand. */
  mark?: boolean | null;
  /** The right answer, released only once the work has been graded. */
  correct?: AnswerValue | null;
};

/**
 * A single, self-contained block type. Everything the app needs to know about a
 * block lives in its module: how to describe it (`meta`), create a blank one
 * (`create`), render it read-only (`View`, for the presenter), and edit it
 * (`Editor`, for the studio). Add a block = add a folder exporting one of these
 * and register it in `registry.ts`; both surfaces pick it up automatically.
 */
export type BlockDefinition<T extends LessonBlock> = {
  meta: BlockMeta;
  create: () => T;
  View: React.FC<BlockViewProps<T>>;
  Editor: React.FC<BlockEditorProps<T>>;
  /** Present only on blocks a student answers. Its absence is what the homework
   *  player uses to tell an exercise from a piece of prose. */
  Answer?: React.FC<BlockAnswerProps<T>>;
};
