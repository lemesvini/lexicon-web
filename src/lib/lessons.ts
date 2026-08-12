// Loads the FULL lesson document (including slides) for a given lesson id.
//
// Sibling to features/homepage/data/situations.ts, which loads the same files
// but strips them down to a summary row for the table. Here we keep the whole
// document because present/control need the slides and teacher notes.
//
// NOTE: block types are hand-written TS for now. Per docs/presenter.md these
// will move to src/schema/ as Zod schemas (a future shared package) — keep the
// shapes framework-free so that extraction stays a copy-paste.

export type TextBlock = {
  type: "text";
  label?: string;
  body: string;
  note?: string;
  audience?: "teacher";
};

export type ListBlock = {
  type: "list";
  label?: string;
  style: "numbered" | "bullet" | "checklist";
  items: string[];
  note?: string;
};

export type CalloutBlock = {
  type: "callout";
  icon?: string;
  color?: string;
  title: string;
  body: string;
  audience?: "teacher";
};

export type TableBlock = {
  type: "table";
  label?: string;
  note?: string;
  columns: { title: string; rows: string[] }[];
};

export type DialogBlock = {
  type: "dialog";
  label?: string;
  note?: string;
  lines: { speaker: string; text: string }[];
};

export type ImageBlock = {
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

export type LessonBlock =
  | TextBlock
  | ListBlock
  | CalloutBlock
  | TableBlock
  | DialogBlock
  | ImageBlock;

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
