// The studio controller, with one rule bolted on: everything this editor adds is
// marked as the group's own, and nothing base can be removed.
//
// A wrapper rather than a flag inside `useStudioLesson`, and rather than a change
// to `createBlock`/`createSlide` — those are shared with the three editors that
// have no idea what advanced context is, and a factory that sometimes stamps a
// flag depending on who called it is the kind of thing that leaks.
//
// The UI already hides what this forbids (see `locked` on SlideCard). This is the
// second lock on the same door: a controller that can't do the thing is worth
// more than a button that isn't drawn.

import { useMemo } from "react";

import { createBlock, type BlockType } from "@/features/blocks";
import { isBase, markAdvanced } from "./advanced-context";
import { useStudioLesson, type StudioController } from "./use-studio-lesson";

export function useAdvancedStudio(): StudioController {
  const studio = useStudioLesson();
  const { lesson, addBlock, addSlide, updateBlock, updateSlideMeta, removeSlide } =
    studio;

  return useMemo<StudioController>(
    () => ({
      ...studio,

      addBlock(slideKey: string, type: BlockType, afterBlockKey?: string) {
        const key = addBlock(slideKey, type, afterBlockKey);
        // Overwritten rather than patched: `createBlock` is the only thing that
        // knows a block's defaults, and a second call gives the same shape. For
        // the exercise kinds it also mints a fresh id, which is fine — this
        // write is what lands in the document.
        updateBlock(slideKey, key, markAdvanced(createBlock(type)));
        return key;
      },

      addSlide(afterKey?: string) {
        const key = addSlide(afterKey);
        updateSlideMeta(key, { advancedContext: true });
        return key;
      },

      removeSlide(key: string) {
        const slide = lesson.slides.find((s) => s.key === key);
        // A base slide belongs to the shared lesson. Silently doing nothing is
        // right here precisely because nothing offers this — reaching it at all
        // means something went wrong upstream, and deleting would be the worse
        // of the two answers.
        if (!slide || isBase(slide.meta)) return;
        removeSlide(key);
      },
    }),
    [
      studio,
      lesson,
      addBlock,
      addSlide,
      updateBlock,
      updateSlideMeta,
      removeSlide,
    ],
  );
}
