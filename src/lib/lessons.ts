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
  /** Draw each item in its own tinted card instead of as a line. An item's
   *  first line becomes the card's heading when there is more than one. */
  cards?: boolean;
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
 * A social post — a tweet or an Instagram post, drawn as the card it would be.
 *
 * Same reasoning as `EmailBlock`: a `text` block can hold the words, but half of
 * what a student is being asked to read is the shape around them — who posted,
 * under what handle, with what picture. Drawing the card is what makes it read
 * as a post rather than as a paragraph about one.
 *
 * The card is a still picture: no like, reply or share affordances, because none
 * of them would do anything. Nothing here is answered either; this is a
 * presentation and material block. A post a student answers *about* is a
 * `choose-description` exercise, whose passage takes the same block markdown.
 */
export type PostBlock = BlockBase & {
  type: "post";
  label?: string;
  /** The handle. Written with or without the `@` — exactly one is drawn. */
  username: string;
  /** The name above the handle. Optional: a handle-only account is a real one. */
  displayName?: string;
  /** Object path of the profile picture in the `lesson-images` bucket (see
   *  @/lib/storage), exactly like `image.path` — a real upload, never invented.
   *  Absent draws the default user icon rather than a hole in the card. */
  avatarPath?: string;
  /** The message. Block markdown: paragraphs, line breaks, headings and lists
   *  are kept as typed. May be empty on a post that is only a photo. */
  body: string;
  /** Object path of the photo attached to the post, same bucket and same rule
   *  as `avatarPath`. */
  imagePath?: string;
  /** Alt text for that photo. */
  imageAlt?: string;
  /** Card treatment: see POST_THEMES. Defaults to "light". */
  theme?: "light" | "dark" | "mist" | "forest";
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

/**
 * A live web page on the slide, in an iframe.
 *
 * The case it exists for is an interactive built elsewhere and pointed at from
 * here — a Claude artifact's `/embed` URL, a video, a map — where the point is
 * that the room can *use* it during the lesson rather than look at a screenshot
 * of it. Nothing about the page is ours: the block owns the frame it sits in and
 * nothing inside it.
 *
 * The height is never a number. A slide is laid out at whatever size the
 * projector is, so the frame is sized by `aspect` (or, with `fill`, by the
 * stage) and the embedded page is left to lay itself out at that size — the same
 * reason `TitleBlock` is drawn as type rather than uploaded as a picture. An
 * `html` snippet is the one source that sizes the frame instead of being sized
 * by it: a card has a height of its own, and it reports it.
 */
export type EmbedBlock = BlockBase & {
  type: "embed";
  label?: string;
  /** Absolute http(s) URL of the page to frame. A share link is rewritten to the
   *  publisher's frameable form where one is known (a YouTube watch URL to its
   *  player); anything else is framed as written. The address of a *post* — an
   *  X status, an Instagram post, a TikTok video — is drawn as the card instead,
   *  exactly as if its embed code had been pasted into `html`. */
  url?: string;
  /** Object path of a page WE host, in the `lesson-embeds` bucket (see
   *  @/lib/storage), for the case `url` cannot serve: a publisher that refuses
   *  to be framed at all. A Claude artifact is exactly that — served with
   *  `frame-ancestors` naming Anthropic's own domains — so its HTML is uploaded
   *  and framed from here instead. Takes precedence over `url` when both are
   *  set, which is what makes "upload a page" a repair rather than a second
   *  block to author. */
  path?: string;
  /** An embed *snippet* — the block of HTML a publisher hands out under "Embed
   *  this post": an X/Twitter `<blockquote class="twitter-tweet">` with its
   *  `widgets.js`, an Instagram or TikTok card, a CodePen. These are not pages
   *  and have no address to frame; they are markup that must run to become the
   *  thing. The script is not what renders it here — it cannot be, it needs its
   *  own origin — so the snippet is read instead: the id comes out of the markup
   *  and the publisher's own embed page is framed at the publisher's origin.
   *  See `snippetSource` in @/features/blocks/embed.
   *
   *  Takes precedence over `path` and `url`, and is the only source sized by its
   *  own content rather than by `aspect`: a tweet is as tall as it is, and the
   *  frame reports its height back and follows it. */
  html?: string;
  /** Accessible name for the frame, read by screen readers. */
  title?: string;
  /** Shape of the frame. Defaults to "16:9". Ignored when `fill` is set, and
   *  ignored for `html`, which measures itself. */
  aspect?: "16:9" | "4:3" | "1:1" | "3:4";
  /** Take the whole slide, edge to edge, the way a wallpaper image does. Any
   *  other block on the slide is laid on top, so a `fill` embed is usually the
   *  only block there. In a student's material — a page, not a stage — there is
   *  no slide to fill and it renders in the flow like any other embed. */
  fill?: true;
  /** Optional caption shown beneath the frame. */
  caption?: string;
  note?: string;
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

/**
 * A sentence with one wrong word in it, found by clicking the word.
 *
 * The options are the sentence's own words, so there is no `options` array:
 * `answer` is an index into the sentence split on whitespace. Punctuation
 * travels with the word it is attached to — "school." is one token, and the
 * student clicks the word rather than the letters — which keeps the tokens the
 * author sees in the editor and the ones the index counts the same list.
 */
export type FindMistakeBlock = BlockBase & {
  type: "find-mistake";
  id: string;
  label?: string;
  /** The sentence, containing exactly one mistake. */
  sentence: string;
  /** Index into `sentence` split on whitespace. Absent in the student's copy. */
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
  | FindMistakeBlock
  | LongAnswerBlock;

/**
 * A group of blocks laid out together, in a row or a column.
 *
 * A slide's own `layout` is one axis for every block on it. That is enough for
 * "text next to an image", and not enough for "a heading over two lists, next to
 * a photo" — the row wants a column inside it. A container is that second axis:
 * it takes the same blocks a slide does and lays them out along its own
 * direction, and a container inside a container nests as deep as the author
 * cares to go.
 *
 * Nothing full-bleed goes inside one — a title cover or a wallpaper image owns
 * the whole slide and has no meaning inside a column — and neither does an
 * exercise, which is answered by id from the top of a homework, not from inside
 * a layout. A teacher-only block inside a container is hidden from the room by
 * the renderer, but note that `strip_teacher_content` (migration 0004) only
 * looks at top-level blocks: keep answer keys at the top level of the slide.
 */
export type ContainerBlock = BlockBase & {
  type: "container";
  /** Which way the children run. Defaults to "column". */
  direction?: "row" | "column";
  /** How the children line up on the cross axis: for a row, top-aligned or
   *  vertically centred; for a column, left-aligned or centred. Defaults to
   *  "start". */
  align?: "start" | "center";
  /** Space between children. Defaults to "md". */
  gap?: "sm" | "md" | "lg";
  blocks: LessonBlock[];
};

export type LessonBlock =
  | ContainerBlock
  | TextBlock
  | ListBlock
  | CalloutBlock
  | TableBlock
  | DialogBlock
  | EmailBlock
  | ImageBlock
  | TitleBlock
  | EmbedBlock
  | PostBlock
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
   *  side by side ("row" — e.g. text next to an image). For a row with a column
   *  inside it, put the column's blocks in a `container` block. */
  layout?: "row" | "column";
  /** Where the content sits on the stage vertically. Defaults to "middle". */
  align?: "top" | "middle" | "bottom";
  /** Where the content column sits horizontally. Defaults to "center"; "left"
   *  with `align: "top"` is the top-left corner. */
  justify?: "left" | "center" | "right";
  /** Drop the "lexicon / English" wordmark from the top of this slide. Unset
   *  falls back to the document's own `hideBrand`. */
  hideBrand?: boolean;
  /** Hide the stage header (the eyebrow + stage name) on this slide. Wallpaper
   *  slides always hide it regardless of this flag. */
  hideStage?: boolean;
  /** A whole slide one group added on top of the shared lesson. The block-level
   *  counterpart of the same flag on `BlockBase`: base slides are locked in the
   *  Advanced Context Studio, slides carrying this are the teacher's own and
   *  fully editable. */
  advancedContext?: true;
  /** Whether an advanced-context slide announces itself on the projector: the
   *  Advanced Context lockup in the stage's top-left corner ("mark", the
   *  default) or nothing at all ("plain") — a slide that reads exactly like a
   *  base one, for a group adding an ordinary slide rather than an aside.
   *  "plain" changes nothing about ownership: the slide is still the group's,
   *  still editable, still carried over by a rebase. Ignored on a slide that
   *  isn't advanced context. Documents written before the mark may carry the old
   *  frame names ("jade" / "forest"); anything that isn't "plain" renders as the
   *  mark. */
  advancedTheme?: "mark" | "plain";
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
  /** The document's default for the wordmark at the top of every slide. A slide
   *  with its own `hideBrand` overrides this. */
  hideBrand?: boolean;
  slides: LessonSlide[];
};

/**
 * Whether the "lexicon / English" wordmark is drawn above a slide.
 *
 * Every surface that projects a slide (present, the studio preview, the
 * student's deck) asks this rather than reading the flags itself, so the three
 * cannot drift. The slide's own flag wins; the document's is the default; and
 * an Advanced Context slide drops it regardless, because its corner lockup
 * already carries the wordmark.
 */
export function showsBrand(
  lesson: Pick<Lesson, "hideBrand"> | undefined,
  slide: LessonSlide,
): boolean {
  if (slide.advancedContext === true && slide.advancedTheme !== "plain")
    return false;
  const hidden = slide.hideBrand ?? lesson?.hideBrand ?? false;
  return !hidden;
}

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
