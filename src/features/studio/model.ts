// Editor state model for the Studio.
//
// The exported artifact is a plain `Lesson` (see @/lib/lessons) — the same shape
// the presenter reads. But while editing we need stable identities for slides
// and blocks so React keys survive reordering and so we never key on array
// index. We keep those keys OUT of the lesson shape by wrapping each slide and
// block in an editor node that carries a client-only `key`. `toLesson` strips
// them back out on export; `fromLesson` assigns fresh ones on load.

import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";

export type EditorBlock = { key: string; data: LessonBlock };

export type EditorSlide = {
  key: string;
  /** Everything on a slide except its blocks (which are wrapped separately). */
  meta: Omit<LessonSlide, "blocks">;
  blocks: EditorBlock[];
};

export type EditorLesson = {
  /** Everything on a lesson except its slides. */
  meta: Omit<Lesson, "slides">;
  slides: EditorSlide[];
};

let counter = 0;
/** Stable client-only id. crypto.randomUUID when available, counter fallback. */
export function newKey(prefix: string): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(counter);
  return `${prefix}_${counter}_${rand}`;
}

// ── Block factories ────────────────────────────────────────────────────────
// Per-block factories live with their block definitions in @/features/blocks
// (`createBlock`). This module stays framework-free so the serialization can be
// lifted into the shared content-schema package later.

export function wrapBlock(data: LessonBlock): EditorBlock {
  return { key: newKey("block"), data };
}

// ── Slide + lesson factories ─────────────────────────────────────────────────

export function createSlide(): EditorSlide {
  return {
    key: newKey("slide"),
    meta: { id: "", stage: "", duration: "", goal: "", teacherNotes: [] },
    blocks: [],
  };
}

export function createLesson(): EditorLesson {
  return {
    meta: {
      id: "",
      unit: "",
      module: "",
      title: "",
      context: "",
      minorCanDo: "",
      grammarFocus: [],
      classPlan: [],
    },
    slides: [createSlide()],
  };
}

// ── (de)serialization ────────────────────────────────────────────────────────

export function fromLesson(lesson: Lesson): EditorLesson {
  // Tolerate lessons missing any field (hand-authored, or exported before this
  // shape settled) — every field is coerced so the editor's inputs stay
  // controlled and nothing downstream reads an `undefined`.
  return {
    meta: {
      id: lesson.id ?? "",
      unit: lesson.unit ?? "",
      module: lesson.module ?? "",
      title: lesson.title ?? "",
      context: lesson.context ?? "",
      minorCanDo: lesson.minorCanDo ?? "",
      grammarFocus: lesson.grammarFocus ?? [],
      classPlan: lesson.classPlan ?? [],
      hideBrand: lesson.hideBrand,
    },
    slides: (lesson.slides ?? []).map((slide) => ({
      key: newKey("slide"),
      meta: {
        id: slide.id ?? "",
        stage: slide.stage ?? "",
        duration: slide.duration ?? "",
        goal: slide.goal ?? "",
        layout: slide.layout,
        align: slide.align,
        justify: slide.justify,
        hideStage: slide.hideStage,
        hideBrand: slide.hideBrand,
        advancedContext: slide.advancedContext,
        advancedTheme: slide.advancedTheme,
        teacherNotes: slide.teacherNotes ?? [],
      },
      blocks: (slide.blocks ?? []).map(wrapBlock),
    })),
  };
}

/**
 * Drop empty strings / empty arrays so the JSON stays clean — but never drop a
 * key listed in `keep`. Required fields must survive even when empty, or the
 * exported document stops matching the `Lesson` contract its consumers rely on.
 */
function prune<T extends Record<string, unknown>>(obj: T, keep: string[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keep.includes(k)) {
      if (v === "" || v === undefined || v === null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
    }
    out[k] = v;
  }
  return out as T;
}

// `audience` and `advancedContext` are absent from every keep-list below and
// survive anyway: both are only ever `true`, and `prune` drops empties, not
// truths. Adding them would be noise repeated eleven times.
function serializeBlock(block: LessonBlock): LessonBlock {
  switch (block.type) {
    // Children are serialized by the same rules as top-level blocks; the
    // defaults ("column", "start", "md") are dropped so an untouched container
    // is as short as it can be.
    case "container":
      return prune(
        {
          ...block,
          direction: block.direction === "row" ? "row" : undefined,
          align: block.align === "center" ? "center" : undefined,
          gap: block.gap && block.gap !== "md" ? block.gap : undefined,
          blocks: block.blocks.map(serializeBlock),
        },
        ["type", "blocks"],
      );
    case "text":
      return prune(block, ["type", "body"]);
    case "callout":
      return prune(block, ["type", "title", "body"]);
    case "list":
      return prune(
        { ...block, items: block.items.filter((i) => i.trim() !== "") },
        ["type", "style", "items"],
      );
    case "table":
      return prune(
        {
          ...block,
          columns: block.columns.map((c) => ({ title: c.title, rows: c.rows })),
        },
        ["type", "columns"],
      );
    case "dialog":
      return prune(
        {
          ...block,
          lines: block.lines.filter(
            (l) => l.speaker.trim() !== "" || l.text.trim() !== "",
          ),
        },
        ["type", "lines"],
      );
    case "email":
      return prune(block, ["type", "body"]);
    case "image":
      return prune(block, ["type", "path"]);
    case "title":
      return prune(block, ["type", "title"]);
    // Nothing but `type` is kept: an embed is either a URL or an uploaded page,
    // and forcing the unused one to survive as `""` would put a field in the
    // document that says the opposite of what the block does.
    case "embed":
      return prune(block, ["type"]);
    case "post":
      return prune(block, ["type", "username", "body"]);
    // Exercise blocks. Two things are deliberate here:
    //
    // `id` is in every keep-list — it is what stored answers are keyed by, so
    // losing it to a prune would orphan every submission for that question.
    //
    // Empty options are NOT filtered out, unlike list items and dialog lines.
    // `answer` is an index into this array, so dropping an empty option in the
    // middle would silently repoint the key at the wrong one. A blank option is
    // an authoring mistake the editor already flags; a wrong answer key is one
    // nobody would ever see.
    case "finish-sentence":
      return prune(block, ["type", "id", "sentence", "options"]);
    case "choose-description":
      return prune(block, ["type", "id", "text", "options"]);
    case "find-mistake":
      return prune(block, ["type", "id", "sentence"]);
    case "long-answer":
      return prune(block, ["type", "id", "question"]);
  }
}

export function toLesson(editor: EditorLesson): Lesson {
  const m = editor.meta;
  return {
    // Lesson-level fields are all required by the `Lesson` type; emit every one
    // (arrays included, even when empty) in the source document's field order.
    id: m.id,
    unit: m.unit,
    module: m.module,
    title: m.title,
    context: m.context,
    minorCanDo: m.minorCanDo,
    grammarFocus: m.grammarFocus.filter((g) => g.trim() !== ""),
    // Only emitted when set: the wordmark is on by default and a document that
    // never touched the setting shouldn't say so.
    ...(m.hideBrand ? { hideBrand: true } : {}),
    classPlan: m.classPlan.filter(
      (s) =>
        s.stage.trim() !== "" ||
        s.duration.trim() !== "" ||
        s.goal.trim() !== "",
    ),
    slides: editor.slides.map((slide) => {
      const sm = slide.meta;
      return {
        ...(prune(
          {
            id: sm.id,
            stage: sm.stage,
            duration: sm.duration,
            goal: sm.goal,
            // Only emit `layout` when it differs from the "column" default, so
            // untouched slides stay byte-for-byte the same in the export.
            layout: sm.layout === "row" ? "row" : undefined,
            // Same for the anchors: "middle" / "center" are the defaults.
            align: sm.align && sm.align !== "middle" ? sm.align : undefined,
            justify:
              sm.justify && sm.justify !== "center" ? sm.justify : undefined,
            hideStage: sm.hideStage ? true : undefined,
            // A slide-level `false` is meaningful — it re-shows the wordmark on
            // a document that hides it by default — so it is kept, unlike the
            // flags above where false and unset are the same thing.
            hideBrand: sm.hideBrand,
            // Only a group's copy ever carries this, so `undefined` (pruned
            // away) is the right shape for every lesson that isn't one.
            advancedContext: sm.advancedContext ? true : undefined,
            advancedTheme: sm.advancedTheme,
            teacherNotes: (sm.teacherNotes ?? []).filter(
              (n) => n.trim() !== "",
            ),
          },
          ["id", "stage", "duration", "goal"],
        ) as Omit<LessonSlide, "blocks">),
        blocks: slide.blocks.map((b) => serializeBlock(b.data)),
      };
    }),
  };
}

/**
 * Best-effort parse of an unknown JSON string into a Lesson. Throws on anything
 * that clearly isn't a lesson; fills in missing arrays so partial docs load.
 */
export function parseLesson(json: string): Lesson {
  const raw = JSON.parse(json) as Partial<Lesson>;
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Not a JSON object");
  }
  if (!Array.isArray(raw.slides)) {
    throw new Error("Missing `slides` array");
  }
  return {
    id: raw.id ?? "",
    unit: raw.unit ?? "",
    module: raw.module ?? "",
    title: raw.title ?? "",
    context: raw.context ?? "",
    minorCanDo: raw.minorCanDo ?? "",
    grammarFocus: raw.grammarFocus ?? [],
    classPlan: raw.classPlan ?? [],
    hideBrand: raw.hideBrand,
    slides: raw.slides.map((s) => ({
      id: s.id ?? "",
      stage: s.stage ?? "",
      duration: s.duration ?? "",
      goal: s.goal ?? "",
      layout: s.layout,
      align: s.align,
      justify: s.justify,
      hideStage: s.hideStage,
      hideBrand: s.hideBrand,
      advancedContext: s.advancedContext,
      advancedTheme: s.advancedTheme,
      blocks: Array.isArray(s.blocks) ? s.blocks : [],
      teacherNotes: s.teacherNotes,
    })),
  };
}
