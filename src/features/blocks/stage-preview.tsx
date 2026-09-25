import * as React from "react";

import { showsBrand, type Lesson, type LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { Audience } from "./types";
import { SlideView } from "./slide-view";

/**
 * The projected slide, in numbers.
 *
 * A slide is laid out at whatever size the projector happens to be, but its
 * *proportions* are fixed: a 16:9 stage, with SlideView placing its content
 * column inside it. Drawing a preview at those exact numbers and scaling the
 * result down is the whole point of this module — a miniature laid out at the
 * frame's own width would re-wrap every line and re-space every block, which is
 * worse than no preview at all, because how it falls on the screen is the main
 * thing the viewer is checking.
 */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

/** The "lexicon / English" lockup at the top of a projected stage. One drawing
 *  of it, used by every surface that projects a slide. */
export function BrandMark() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-6">
      <span className="font-display text-3xl lowercase leading-none tracking-tight text-primary">
        lexicon
      </span>
      <span className="font-sans text-[0.625rem] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        English
      </span>
    </header>
  );
}

/**
 * One slide, drawn the way the room will see it: the presenter's own markup at
 * the presenter's own size, scaled to fit whatever width it is given.
 *
 * Used by the studio (above each slide's fields) and by the teacher's control
 * device — both places where the thing being checked is how the slide lands on
 * the stage, not what it says.
 */
export function StagePreview({
  slide,
  lesson,
  audience = "teacher",
  className,
}: {
  slide: LessonSlide;
  /** The document's own defaults — today just whether the wordmark is on. */
  lesson?: Pick<Lesson, "hideBrand">;
  audience?: Audience;
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
        {/* Mirrors the present route. Kept in step by hand rather than shared:
            the presenter owns fullscreen, the whiteboard and the live
            connection, none of which belong in a still picture. */}
        <div className="relative h-full w-full overflow-hidden text-foreground">
          {showsBrand(lesson, slide) && <BrandMark />}
          <SlideView slide={slide} audience={audience} />
        </div>
      </div>
    </div>
  );
}
