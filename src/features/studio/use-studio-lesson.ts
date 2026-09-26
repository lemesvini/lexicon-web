import { useCallback, useMemo, useState } from "react";
import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";
import { createBlock, newBlockId, type BlockType } from "@/features/blocks";
import {
  createLesson,
  createSlide,
  fromLesson,
  toLesson,
  wrapBlock,
  type EditorLesson,
  type EditorSlide,
} from "./model";

/**
 * Copies a block for duplication, minting a fresh `id` on the kinds that carry
 * one.
 *
 * Exercise blocks are identified in a submission by that id, so a duplicate
 * keeping the original's would make two questions share every answer ever given
 * to either — and the copy is usually made precisely to edit it into a different
 * question.
 */
function cloneBlock(block: LessonBlock): LessonBlock {
  const copy = structuredClone(block);
  return "id" in copy ? { ...copy, id: newBlockId() } : copy;
}

/** The can-do slide's eyebrow for a lesson title, minus the "[Lesson Two]"
 *  prefix the library uses to sort by. */
function canDoEyebrow(title: string): string {
  const name = title.replace(/^\[[^\]]*\]\s*/, "").trim();
  return name ? `Lesson complete · ${name}` : "Lesson complete";
}

/** Move item at `index` by `dir` (-1 up, +1 down); returns a new array. */
function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = arr.slice();
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

export function useStudioLesson() {
  const [lesson, setLesson] = useState<EditorLesson>(createLesson);

  const load = useCallback((doc: Lesson) => setLesson(fromLesson(doc)), []);
  const reset = useCallback(() => setLesson(createLesson()), []);

  const updateMeta = useCallback((patch: Partial<EditorLesson["meta"]>) => {
    setLesson((l) => ({ ...l, meta: { ...l.meta, ...patch } }));
  }, []);

  const mapSlide = useCallback(
    (key: string, fn: (s: EditorSlide) => EditorSlide) => {
      setLesson((l) => ({
        ...l,
        slides: l.slides.map((s) => (s.key === key ? fn(s) : s)),
      }));
    },
    [],
  );

  const updateSlideMeta = useCallback(
    (key: string, patch: Partial<Omit<LessonSlide, "blocks">>) => {
      mapSlide(key, (s) => ({ ...s, meta: { ...s.meta, ...patch } }));
    },
    [mapSlide],
  );

  const addSlide = useCallback((afterKey?: string) => {
    const slide = createSlide();
    setLesson((l) => {
      if (!afterKey) return { ...l, slides: [...l.slides, slide] };
      const i = l.slides.findIndex((s) => s.key === afterKey);
      const slides = l.slides.slice();
      slides.splice(i + 1, 0, slide);
      return { ...l, slides };
    });
    return slide.key;
  }, []);

  const removeSlide = useCallback((key: string) => {
    setLesson((l) => ({
      ...l,
      slides: l.slides.filter((s) => s.key !== key),
    }));
  }, []);

  const duplicateSlide = useCallback((key: string) => {
    setLesson((l) => {
      const i = l.slides.findIndex((s) => s.key === key);
      if (i === -1) return l;
      const src = l.slides[i];
      const copy: EditorSlide = {
        key: createSlide().key,
        meta: { ...src.meta, id: src.meta.id ? `${src.meta.id}-copy` : "" },
        blocks: src.blocks.map((b) => wrapBlock(cloneBlock(b.data))),
      };
      const slides = l.slides.slice();
      slides.splice(i + 1, 0, copy);
      return { ...l, slides };
    });
  }, []);

  const moveSlide = useCallback((key: string, dir: -1 | 1) => {
    setLesson((l) => {
      const i = l.slides.findIndex((s) => s.key === key);
      return i === -1 ? l : { ...l, slides: move(l.slides, i, dir) };
    });
  }, []);

  const addBlock = useCallback(
    (slideKey: string, type: BlockType, afterBlockKey?: string) => {
      const created = createBlock(type);
      // A can-do slide starts from the lesson's own minor can-do; see
      // `CanDoBlock` for why it is a copy.
      const block = wrapBlock(
        created.type === "can-do"
          ? {
              ...created,
              eyebrow: canDoEyebrow(lesson.meta.title),
              text: lesson.meta.minorCanDo,
            }
          : created,
      );
      mapSlide(slideKey, (s) => {
        if (!afterBlockKey) return { ...s, blocks: [...s.blocks, block] };
        const i = s.blocks.findIndex((b) => b.key === afterBlockKey);
        const blocks = s.blocks.slice();
        blocks.splice(i + 1, 0, block);
        return { ...s, blocks };
      });
      return block.key;
    },
    [mapSlide, lesson.meta.minorCanDo, lesson.meta.title],
  );

  const updateBlock = useCallback(
    (slideKey: string, blockKey: string, data: LessonBlock) => {
      mapSlide(slideKey, (s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.key === blockKey ? { ...b, data } : b)),
      }));
    },
    [mapSlide],
  );

  const removeBlock = useCallback(
    (slideKey: string, blockKey: string) => {
      mapSlide(slideKey, (s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.key !== blockKey),
      }));
    },
    [mapSlide],
  );

  const duplicateBlock = useCallback(
    (slideKey: string, blockKey: string) => {
      mapSlide(slideKey, (s) => {
        const i = s.blocks.findIndex((b) => b.key === blockKey);
        if (i === -1) return s;
        const copy = wrapBlock(cloneBlock(s.blocks[i].data));
        const blocks = s.blocks.slice();
        blocks.splice(i + 1, 0, copy);
        return { ...s, blocks };
      });
    },
    [mapSlide],
  );

  const moveBlock = useCallback(
    (slideKey: string, blockKey: string, dir: -1 | 1) => {
      mapSlide(slideKey, (s) => {
        const i = s.blocks.findIndex((b) => b.key === blockKey);
        return i === -1 ? s : { ...s, blocks: move(s.blocks, i, dir) };
      });
    },
    [mapSlide],
  );

  const document = useMemo(() => toLesson(lesson), [lesson]);

  return {
    lesson,
    /** The serialized `Lesson` — recomputed on every edit. */
    document,
    load,
    reset,
    updateMeta,
    updateSlideMeta,
    addSlide,
    removeSlide,
    duplicateSlide,
    moveSlide,
    addBlock,
    updateBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
  };
}

export type StudioController = ReturnType<typeof useStudioLesson>;
