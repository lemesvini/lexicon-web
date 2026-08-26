// What "advanced context" means to the editor: which parts of a group's copy are
// theirs, and which are the shared lesson they may add to but not change.
//
// The whole distinction rides on one flag — `advancedContext: true` on a block or
// a slide (see @/lib/lessons). Nothing is stored twice and nothing is diffed
// against the base at read time: a block either carries the flag or it is base
// material. That is what lets the presenter render a group's document with no
// knowledge of any of this, and what lets `rebaseOnto` pull the two apart again
// when the base lesson moves on.

import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";

/** Base material: part of the shared lesson, not this group's addition. */
export function isBase(x: { advancedContext?: true }): boolean {
  return x.advancedContext !== true;
}

/** Marks a block or slide as this group's own. */
export function markAdvanced<T extends { advancedContext?: true }>(x: T): T {
  return { ...x, advancedContext: true };
}

/**
 * A stable id for a slide a group is adding.
 *
 * Not cosmetic. `rebaseOnto` anchors everything by `slide.id`, and `createSlide`
 * leaves it empty — so a slide added without one is orphaned the first time the
 * teacher presses "Refresh from base", and shows up in no group history. Derived
 * from the stage name so that a human reading the raw JSON, or a line of history
 * saying `B1L9 — slide "Marina's Weekend"`, can tell which slide is meant.
 *
 * The `ac-` prefix marks it as a group's addition rather than something an author
 * typed, and the suffix is what keeps two slides called "Practice" apart.
 */
export function advancedSlideId(stage: string, used: Iterable<string>): string {
  const slug =
    stage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "slide";

  const taken = new Set(used);
  let candidate = `ac-${slug}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `ac-${slug}-${n}`;
    n += 1;
  }
  return candidate;
}

/**
 * What a suggestion anchors to, for a slide that may have no id of its own.
 *
 * Presentations are hand-authored JSON and their slides carry ids. The other two
 * kinds are built in the Studio, where `createSlide` leaves the id empty and
 * nothing asks the author to fill it — so anchoring on ids alone meant the agent
 * had nowhere to put anything, and said so.
 *
 * The fallback is positional and derived, never stored: `#3` is "after the third
 * slide as it stands". Both sides compute it the same way from the same list, so
 * they agree without either writing to the document. It is only good for the
 * length of one exchange, which is exactly how long an anchor needs to live —
 * the inserted slide gets an id of its own (see `advancedSlideId`).
 */
export function anchorId(slideId: string, index: number): string {
  return slideId || `#${index + 1}`;
}

/** Every block a group has added, across the whole document — what the Lessons
 *  tab counts and the drawer uses to avoid suggesting the same thing twice. */
export function advancedBlocks(doc: Lesson): LessonBlock[] {
  return (doc.slides ?? []).flatMap((slide) =>
    slide.advancedContext
      ? slide.blocks
      : slide.blocks.filter((b) => b.advancedContext === true),
  );
}

/** How many additions a copy carries. A slide the teacher added counts as one
 *  even when it is still empty — they did add it. */
export function advancedCount(doc: Lesson): number {
  const slides = (doc.slides ?? []).filter((s) => s.advancedContext).length;
  const blocks = (doc.slides ?? [])
    .filter((s) => !s.advancedContext)
    .reduce(
      (n, s) => n + s.blocks.filter((b) => b.advancedContext === true).length,
      0,
    );
  return slides + blocks;
}

/**
 * Rebuilds a group's copy on top of a newer version of the base lesson.
 *
 * The base half is thrown away and taken fresh; the group's half is carried
 * over, anchored by `slide.id`. Two rules make this safe to offer as a button:
 *
 *   Nothing the teacher wrote is ever dropped. A block whose slide no longer
 *   exists in the base — renamed, deleted, merged — lands on a slide appended at
 *   the end rather than disappearing quietly. Losing work to a refresh is a much
 *   worse failure than an orphan slide somebody has to re-file.
 *
 *   Base edits win over the copy's base half, always. That is the entire point
 *   of pressing the button, and the reason base blocks are read-only in the first
 *   place: if they weren't, this would have edits to reconcile and no way to.
 *
 * Anchoring on `slide.id` rather than position is deliberate — a base lesson that
 * gained a slide in the middle would otherwise scatter every addition after it.
 * Slides with an empty id (the editor allows it) can't be anchored and are
 * treated as unmatched.
 */
export function rebaseOnto(base: Lesson, current: Lesson): Lesson {
  // Blocks the group added, grouped by the base slide they sat on.
  const additions = new Map<string, LessonBlock[]>();
  // Whole slides the group added, in the order they appear.
  const ownSlides: LessonSlide[] = [];
  const orphans: LessonBlock[] = [];

  const baseIds = new Set(
    (base.slides ?? []).map((s) => s.id).filter((id) => id !== ""),
  );

  for (const slide of current.slides ?? []) {
    if (slide.advancedContext) {
      ownSlides.push(slide);
      continue;
    }
    const added = slide.blocks.filter((b) => b.advancedContext === true);
    if (added.length === 0) continue;

    if (slide.id !== "" && baseIds.has(slide.id)) {
      additions.set(slide.id, [...(additions.get(slide.id) ?? []), ...added]);
    } else {
      orphans.push(...added);
    }
  }

  const slides: LessonSlide[] = (base.slides ?? []).map((slide) => {
    const added = additions.get(slide.id);
    return added ? { ...slide, blocks: [...slide.blocks, ...added] } : slide;
  });

  if (orphans.length > 0) {
    slides.push(
      markAdvanced<LessonSlide>({
        id: "advanced-context-unfiled",
        stage: "Advanced context",
        duration: "",
        goal: "Blocks whose original slide is no longer in the lesson.",
        blocks: orphans,
      }),
    );
  }

  // The group's own slides go last: the base decides its own running order, and
  // there is no honest place to slot them back into a lesson that has changed.
  slides.push(...ownSlides);

  // Meta comes from the base — title, unit, grammar focus are the lesson's, not
  // the copy's. Only the slides were ever this group's to own.
  return { ...base, slides };
}
