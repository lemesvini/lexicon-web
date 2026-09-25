import * as React from "react";

import type { Lesson, LessonSlide } from "@/lib/lessons";
import { StagePreview } from "@/features/blocks";
import type { EditorSlide } from "../model";

/**
 * The studio's picture of a slide: the shared stage preview, fed the editor's
 * slide as the presenter's `Lesson` shape — the client-only keys that make React
 * reordering work are exactly what the renderer doesn't want.
 *
 * `audience="teacher"` rather than the projector's "student": the studio is the
 * teacher's surface, and a block they marked teacher-only is one they still
 * need to be able to see and place.
 */
export function SlidePreview({
  slide,
  lesson,
  className,
}: {
  slide: EditorSlide;
  /** The document's own defaults — today just whether the wordmark is on. */
  lesson?: Pick<Lesson, "hideBrand">;
  className?: string;
}) {
  const projected: LessonSlide = React.useMemo(
    () => ({ ...slide.meta, blocks: slide.blocks.map((b) => b.data) }),
    [slide],
  );
  return (
    <StagePreview
      slide={projected}
      lesson={lesson}
      audience="teacher"
      className={className}
    />
  );
}
