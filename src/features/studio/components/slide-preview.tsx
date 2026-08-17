import * as React from "react";

import type { LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import { SlideView } from "@/features/blocks";
import type { EditorSlide } from "../model";

/**
 * The projected slide, in numbers.
 *
 * A slide is laid out at whatever size the projector happens to be, but its
 * *proportions* are fixed: a 16:9 stage with `px-16 py-24` around a centred
 * `max-w-4xl` content column. Drawing the preview at those exact numbers and
 * scaling the result down is the whole point of this module — a miniature laid
 * out at the studio's own width would re-wrap every line and re-space every
 * block, which is worse than no preview at all, because how it falls on the
 * screen is the main thing an author is checking.
 */
const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;

/**
 * One slide, drawn the way the room will see it: the presenter's own markup at
 * the presenter's own size, scaled to fit whatever width it is given.
 *
 * `audience="teacher"` rather than the projector's "student": the studio is the
 * teacher's surface, and a block they marked teacher-only is one they still
 * need to be able to see and place.
 */
export function SlidePreview({
  slide,
  className,
}: {
  slide: EditorSlide;
  className?: string;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0);

  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // Measured up front as well as on resize: the observer's first callback
    // lands after this pass, and a stage drawn at scale 0 is a visible flash.
    const measure = () => {
      if (frame.clientWidth > 0) setScale(frame.clientWidth / STAGE_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // The editor's slide, as the presenter's `Lesson` shape — the client-only keys
  // that make React reordering work are exactly what the renderer doesn't want.
  const projected: LessonSlide = React.useMemo(
    () => ({ ...slide.meta, blocks: slide.blocks.map((b) => b.data) }),
    [slide],
  );

  return (
    // `aspect-video`, not a measured height: the stage is always 16:9, so the
    // frame can reserve its own space and never reflows as the slide fills up.
    <div
      ref={frameRef}
      aria-hidden
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border-2 border-primary/40 bg-background shadow-sm",
        className,
      )}
    >
      <div
        className={cn(scale === 0 && "invisible")}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Everything below mirrors the present route. Kept in step by hand
            rather than shared: the presenter owns fullscreen, the whiteboard and
            the live connection, none of which belong in a still picture. */}
        <div className="relative h-full w-full overflow-hidden text-foreground">
          <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-6">
            <span className="font-display text-3xl lowercase leading-none tracking-tight text-primary">
              lexicon
            </span>
            <span className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              English
            </span>
          </header>

          <div className="relative flex h-full items-center justify-center px-16 py-24">
            <SlideView slide={projected} audience="teacher" />
          </div>
        </div>
      </div>
    </div>
  );
}
