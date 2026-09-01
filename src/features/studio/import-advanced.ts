// Bringing a group's presentation additions across to what its students read.
//
// A class's advanced context is written where it is first needed — in the
// presentation, during or right after the lesson. The same paragraphs are then
// wanted in that group's student material, and retyping them is both work and a
// way for the two documents to drift apart.
//
// This copies in one direction only, and never overwrites: the additions land as
// new slides at the end of the target, and anything already carried across is
// left alone (see `skipped`). The base halves of the two documents are different
// documents and are not touched.

import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";
import { newBlockId } from "@/features/blocks";
import { stripTeacherContent } from "./strip-teacher";
import { markAdvanced } from "./advanced-context";

/** Where blocks the presentation added to one of its own base slides land — the
 *  target has no slide of that name to put them back on. */
const UNFILED_ID = "ac-from-presentation";

export type ImportResult = {
  document: Lesson;
  /** Slides and blocks brought across by this run. */
  added: number;
  /** Additions that were already here, from an earlier run. */
  skipped: number;
};

/** A block's identity for the purpose of "is this already here?" — its content,
 *  minus the ids that are minted per copy and would never match. */
function fingerprint(block: LessonBlock): string {
  const { ...rest } = block as LessonBlock & { id?: string };
  delete (rest as { id?: string }).id;
  return JSON.stringify(rest);
}

/** Exercise blocks are keyed on by submissions (migration 0005), so a copy gets
 *  an id of its own rather than sharing the original's. */
function reidentify(block: LessonBlock): LessonBlock {
  return "id" in block
    ? ({ ...block, id: newBlockId() } as LessonBlock)
    : block;
}

/**
 * Appends the advanced context of `source` to `target`.
 *
 * Teacher-only content is dropped on the way: the target is a student document,
 * and the database strips it on write anyway (see `stripTeacherContent`) — doing
 * it here means the editor shows what the save will keep.
 */
export function importAdvancedFrom(source: Lesson, target: Lesson): ImportResult {
  const clean = stripTeacherContent(source);

  const targetSlides = target.slides ?? [];
  const takenIds = new Set(targetSlides.map((s) => s.id).filter(Boolean));
  const seen = new Set(
    targetSlides.flatMap((slide) =>
      (slide.advancedContext
        ? slide.blocks
        : slide.blocks.filter((b) => b.advancedContext === true)
      ).map(fingerprint),
    ),
  );

  const slides: LessonSlide[] = [];
  const unfiled: LessonBlock[] = [];
  let added = 0;
  let skipped = 0;

  for (const slide of clean.slides ?? []) {
    if (slide.advancedContext) {
      // Anchored by id, the way `rebaseOnto` anchors everything: a slide whose
      // id is already here came across on an earlier run.
      if (slide.id && takenIds.has(slide.id)) {
        skipped += 1;
        continue;
      }
      slides.push(
        markAdvanced<LessonSlide>({
          ...slide,
          blocks: slide.blocks.map((b) => markAdvanced(reidentify(b))),
        }),
      );
      if (slide.id) takenIds.add(slide.id);
      added += 1;
      continue;
    }

    for (const block of slide.blocks.filter((b) => b.advancedContext === true)) {
      if (seen.has(fingerprint(block))) {
        skipped += 1;
        continue;
      }
      seen.add(fingerprint(block));
      unfiled.push(markAdvanced(reidentify(block)));
      added += 1;
    }
  }

  if (added === 0) return { document: target, added, skipped };

  const existingUnfiled = targetSlides.find((s) => s.id === UNFILED_ID);
  const next = targetSlides.map((slide) =>
    slide === existingUnfiled
      ? { ...slide, blocks: [...slide.blocks, ...unfiled] }
      : slide,
  );

  if (unfiled.length > 0 && !existingUnfiled) {
    next.push(
      markAdvanced<LessonSlide>({
        id: UNFILED_ID,
        stage: "From the presentation",
        duration: "",
        goal: "Blocks this group added to the presentation's own slides.",
        blocks: unfiled,
      }),
    );
  }

  return { document: { ...target, slides: [...next, ...slides] }, added, skipped };
}
