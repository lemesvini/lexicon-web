// Putting an agent's proposal into the document.
//
// Shared by the three editors that can ask for one (a group's presentation, its
// student material, its homework) because the act is identical in all three: a
// new slide after a named anchor, stamped as this group's own, with the proposed
// blocks on it.
//
// The two details that aren't obvious are both about identity. The slide gets a
// minted `id` rather than the empty one `createSlide` leaves — `rebaseOnto`
// anchors by slide id, so an unanchored slide is orphaned by the first Refresh
// from base. And an exercise block keeps a minted block id rather than whatever
// the model did or didn't supply: a submission is a map from block id to answer
// (migration 0005), so the id has to be unique in the document and stable
// forever, and only the client can promise the first of those.

import { newBlockId, type BlockType } from "@/features/blocks";
import type { LessonBlock } from "@/lib/lessons";
import { advancedSlideId, anchorId } from "./advanced-context";
import type { ContextSuggestion } from "./data/suggest-context";
import type { StudioController } from "./use-studio-lesson";

/** The kinds whose blocks carry an id the rest of the system keys on. */
const EXERCISE_TYPES = new Set<BlockType>([
  "finish-sentence",
  "choose-description",
  "find-mistake",
  "long-answer",
]);

/**
 * Adds a suggested slide after its anchor.
 *
 * False when the anchor has since gone — the agent was shown the document as it
 * was when the drawer asked, and a slide it wanted to sit after may have been
 * removed or renamed since.
 */
export function insertSuggestion(
  studio: StudioController,
  suggestion: ContextSuggestion,
): boolean {
  // By the same rule the agent was shown them under: a slide's own id when it
  // has one, its position when it doesn't.
  const wanted = suggestion.afterSlideId.trim();
  const exact = studio.lesson.slides.find(
    (slide, index) => anchorId(slide.meta.id, index) === wanted,
  );

  // A positional anchor echoed back without its "#" — "3" for the third slide.
  // Worth catching rather than refusing: the alternative is telling the teacher
  // their anchor is gone when it is right there, over a character.
  const positional = /^#?(\d+)$/.exec(wanted);
  const byPosition = positional
    ? studio.lesson.slides[Number(positional[1]) - 1]
    : undefined;

  const anchor = exact ?? byPosition;
  if (!anchor) return false;

  const used = studio.lesson.slides.map((slide) => slide.meta.id).filter(Boolean);
  const slideKey = studio.addSlide(anchor.key);
  studio.updateSlideMeta(slideKey, {
    id: advancedSlideId(suggestion.stage, used),
    stage: suggestion.stage,
  });

  for (const block of suggestion.blocks) {
    // The slide comes through the controller, so `useAdvancedStudio` stamps it
    // as advanced context; a block's stamp is applied by hand because
    // `updateBlock` isn't wrapped.
    const blockKey = studio.addBlock(slideKey, block.type);
    studio.updateBlock(slideKey, blockKey, withIdentity(block));
  }

  return true;
}

function withIdentity(block: LessonBlock): LessonBlock {
  const stamped = { ...block, advancedContext: true as const };
  // The cast is the narrow one TypeScript can't do for us: `id` belongs to the
  // exercise members of the union and the set above is exactly those, but the
  // check is a runtime one on a string.
  return EXERCISE_TYPES.has(block.type)
    ? ({ ...stamped, id: newBlockId() } as LessonBlock)
    : stamped;
}
