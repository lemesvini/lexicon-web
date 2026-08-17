// Loads the FULL lesson document (including slides) for a given lesson id.
//
// Sibling to features/homepage/data/situations.ts, which loads the same files
// but strips them down to a summary row for the table. Here we keep the whole
// document because present/control need the slides and teacher notes.
//
// NOTE: block types are hand-written TS for now. Per docs/presenter.md these
// will move to src/schema/ as Zod schemas (a future shared package) — keep the
// shapes framework-free so that extraction stays a copy-paste.

/**
 * What every block carries, whatever its type.
 *
 * `audience: "teacher"` marks a block as the teacher's alone — an answer key, a
 * profile card, a line to read out but not to project. The control device shows
 * them, the projected slide does not, and no student document may contain one:
 * `strip_teacher_content` (migration 0004) drops any block carrying the flag,
 * regardless of type, which is why it belongs on the base rather than on the
 * handful of block types that happened to need it first.
 */
export type BlockBase = {
  audience?: "teacher";
};

export type TextBlock = BlockBase & {
  type: "text";
  label?: string;
  body: string;
  note?: string;
};

export type ListBlock = BlockBase & {
  type: "list";
  label?: string;
  style: "numbered" | "bullet" | "checklist";
  items: string[];
  note?: string;
};

export type CalloutBlock = BlockBase & {
  type: "callout";
  icon?: string;
  color?: string;
  title: string;
  body: string;
};

export type TableBlock = BlockBase & {
  type: "table";
  label?: string;
  note?: string;
  columns: { title: string; rows: string[] }[];
};

export type DialogBlock = BlockBase & {
  type: "dialog";
  label?: string;
  note?: string;
  lines: { speaker: string; text: string }[];
};

/**
 * A cover: eyebrow, wordmark, and one huge headline on a flat brand colour.
 *
 * This is the presentation-only "big title" from docs/presenter.md, and it is
 * drawn as type rather than uploaded as a wallpaper image on purpose. An image
 * has one aspect ratio and every screen it is thrown at crops it; type is laid
 * out per screen, so the same cover holds its proportions on a 16:9 projector, a
 * 16:10 laptop and a phone in a student's material.
 */
export type TitleBlock = BlockBase & {
  type: "title";
  /** Small line above the headline, e.g. "Lesson One". */
  eyebrow?: string;
  /** The headline. Line breaks are kept — that is how the author says where it
   *  wraps, since the type is sized to the longest line. */
  title: string;
  /** Optional quieter line beneath the headline. */
  subtitle?: string;
  /** Colour treatment: see TITLE_COLORS. Defaults to "jade". */
  color?: "jade" | "forest" | "mist" | "clear";
  /** Drop the "lexicon" wordmark from the top-right corner. */
  hideWordmark?: boolean;
};

export type ImageBlock = BlockBase & {
  type: "image";
  label?: string;
  /** Object path inside the Supabase Storage bucket (see @/lib/storage). The
   *  public URL is derived from this at render time, so the JSON stays portable
   *  even if the bucket's public base URL changes. */
  path: string;
  /** Alt text for accessibility. */
  alt?: string;
  /** Optional caption shown beneath the image. */
  caption?: string;
  note?: string;
  /** When true, the image covers the whole slide as a full-bleed background
   *  (Full HD 1920×1080 recommended); any other blocks render on top of it. */
  wallpaper?: boolean;
};

// ── Exercise blocks ─────────────────────────────────────────────────────────
// Blocks a student answers rather than reads. Only homework uses them.
//
// Two things set them apart from every block above:
//
//   `id` is required and stable. A submission is a map from block id to answer
//   (see supabase/migrations/0005_homework_exercises.sql), so keying by position
//   would scramble every answer already given the first time a question moves.
//
//   `answer` is optional in the TYPE but always present in the teacher's copy.
//   It is optional because the student's copy genuinely does not have it: the
//   `student_homework` view strips it on the way out, so the shape they receive
//   is this one minus the key.

/** Marks the gap in a `finish-sentence` prompt. */
export const SENTENCE_BLANK = "___";

/** A sentence with one word missing, chosen from a few options. */
export type FinishSentenceBlock = BlockBase & {
  type: "finish-sentence";
  id: string;
  label?: string;
  /** The sentence, with `___` where the missing word goes. */
  sentence: string;
  options: string[];
  /** Index into `options`. Absent in the student's copy. */
  answer?: number;
  note?: string;
};

/** A passage, and a set of descriptions of it — one of them right. */
export type ChooseDescriptionBlock = BlockBase & {
  type: "choose-description";
  id: string;
  label?: string;
  /** The passage the student reads, in English. */
  text: string;
  /** The descriptions to choose between, in the student's own language. */
  options: string[];
  /** Index into `options`. Absent in the student's copy. */
  answer?: number;
  note?: string;
};

/** A question answered in the student's own words. Marked by hand. */
export type LongAnswerBlock = BlockBase & {
  type: "long-answer";
  id: string;
  label?: string;
  question: string;
  /** Guidance on the expected shape, e.g. "3–5 sentences". */
  hint?: string;
  note?: string;
};

export type ExerciseBlock =
  | FinishSentenceBlock
  | ChooseDescriptionBlock
  | LongAnswerBlock;

export type LessonBlock =
  | TextBlock
  | ListBlock
  | CalloutBlock
  | TableBlock
  | DialogBlock
  | ImageBlock
  | TitleBlock
  | ExerciseBlock;

/** What a student's answer to one block looks like: an option index for the
 *  objective blocks, free text for the written one. */
export type AnswerValue = number | string;

export type LessonSlide = {
  id: string;
  stage: string;
  duration: string;
  goal: string;
  /** How the slide's blocks are arranged: stacked ("column", the default) or
   *  side by side ("row" — e.g. text next to an image). */
  layout?: "row" | "column";
  /** Hide the stage header (the eyebrow + stage name) on this slide. Wallpaper
   *  slides always hide it regardless of this flag. */
  hideStage?: boolean;
  blocks: LessonBlock[];
  teacherNotes?: string[];
};

export type Lesson = {
  id: string;
  unit: string;
  module: string;
  title: string;
  context: string;
  minorCanDo: string;
  grammarFocus: string[];
  classPlan: { stage: string; duration: string; goal: string }[];
  slides: LessonSlide[];
};

const modules = import.meta.glob("/src/situations/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Lesson>;

const lessonsById = new Map<string, Lesson>(
  Object.values(modules).map((lesson) => [lesson.id, lesson]),
);

/** Returns the full lesson document for an id, or undefined if unknown. */
export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}
