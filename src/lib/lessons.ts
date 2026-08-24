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
 *
 * `advancedContext: true` marks a block one group added on top of the shared
 * lesson — the extra example, the vocabulary this room keeps tripping over. It
 * only ever appears inside a `group_lessons` document (migration 0010), never in
 * a base lesson, and it is on the base type for the same reason `audience` is:
 * any block may be one. Everything that renders it draws the primary-bordered
 * "Advanced Context" frame; everything that edits it treats the blocks WITHOUT
 * the flag as read-only base material.
 */
export type BlockBase = {
  audience?: "teacher";
  advancedContext?: true;
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
 * An email, drawn as the macOS Mail compose window it would really be seen in.
 *
 * A `text` block can hold the same words, but half of what a student is being
 * asked to read is the shape around them: who it is to, what the subject line
 * says, where the greeting stops and the body starts. Drawing the window is what
 * makes it read as an email rather than as a paragraph about one.
 *
 * The chrome is a still picture: traffic lights, and nothing that does anything.
 * Nothing here is answered either; this is a presentation and material block. An
 * email a student answers *about* is a `choose-description` exercise, whose
 * passage takes the same block markdown.
 */
export type EmailBlock = BlockBase & {
  type: "email";
  label?: string;
  /** Window treatment: the two macOS ones, plus two in the brand's own greens.
   *  See EMAIL_THEMES. Defaults to "light". */
  theme?: "light" | "dark" | "mist" | "forest";
  /** Header rows. Each is drawn only when it has a value, so an email with no
   *  `cc` is a window with no Cc line rather than one with an empty one. */
  to?: string;
  cc?: string;
  subject?: string;
  from?: string;
  /** The message. Block markdown: paragraphs, line breaks, headings and lists
   *  are kept as typed — a greeting, a body and a sign-off are three
   *  paragraphs, and that spacing is part of the email. */
  body: string;
  note?: string;
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
  /** The passage the student reads, in English. Block markdown: paragraphs,
   *  line breaks, headings and lists are kept as typed. */
  text: string;
  /** How the passage is set. "mono" for anything whose own layout is part of
   *  the reading — an email, a chat, a form. Defaults to "sans". */
  font?: "sans" | "mono";
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
  | EmailBlock
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
  /** A whole slide one group added on top of the shared lesson. The block-level
   *  counterpart of the same flag on `BlockBase`: base slides are locked in the
   *  Advanced Context Studio, slides carrying this are the teacher's own and
   *  fully editable. */
  advancedContext?: true;
  /** How an advanced-context slide is framed on the projector: the brand green
   *  around a dark panel ("jade", the default), or the dark ground around a pale
   *  one ("forest"). Ignored on a slide that isn't advanced context. */
  advancedTheme?: "jade" | "forest";
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
