import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";

import { BrandMark, SlideView } from "@/features/blocks";
import { useArrowKeyNav } from "@/features/presenter/use-arrow-key-nav";
import { showsBrand, type Lesson } from "@/lib/lessons";
import { fetchStudentPresentation } from "@/lib/student-content";
import { cn } from "@/lib/utils";

/**
 * The class deck for one lesson, fetched when it is opened.
 *
 * Deliberately lazy: this is the teacher's presentation, a bigger document than
 * the material and one most visits to a lesson page never ask for. Loading it
 * with the page would put it on every read of every lesson to serve the one
 * click that wants it.
 */
export function LessonSlides({
  lessonId,
  onClose,
}: {
  lessonId: string;
  onClose: () => void;
}) {
  const [state, setState] = React.useState<{
    status: "loading" | "ready" | "empty" | "error";
    document: Lesson | null;
  }>({ status: "loading", document: null });

  React.useEffect(() => {
    let cancelled = false;

    fetchStudentPresentation(lessonId)
      .then((doc) => {
        if (cancelled) return;
        setState({
          status: doc ? "ready" : "empty",
          document: doc,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", document: null });
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (state.status === "ready" && state.document) {
    return <SlidesViewer document={state.document} onClose={onClose} />;
  }

  return (
    <Stage onClose={onClose}>
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
        {state.status === "loading" ? (
          <Loader2Icon className="size-6 animate-spin" />
        ) : state.status === "empty" ? (
          <p>The slides for this lesson aren’t available.</p>
        ) : (
          <p>Couldn’t load the slides. Please try again.</p>
        )}
      </div>
    </Stage>
  );
}

/**
 * The student's own copy of the presenter: the class deck shown one slide at a
 * time, the way the teacher projected it.
 *
 * Same stage as @/routes/_authenticated/_admin/present — SlideView on a
 * `relative` full-height container, so a wallpaper image still anchors a
 * full-bleed background — but driven locally instead of by the realtime channel.
 * Nothing here talks to the control page: this is a student reading a lesson
 * back on their own, not a second screen for the classroom.
 *
 * The document arrives already scrubbed of teacher notes and answer keys by
 * `student_presentations` (migration 0018), so `audience="student"` here is belt
 * and braces rather than the actual guarantee.
 */
function SlidesViewer({
  document: doc,
  onClose,
}: {
  document: Lesson;
  onClose: () => void;
}) {
  // Same filter the document view uses: an empty slide is an authoring artefact,
  // and one blank stage in the middle of a deck reads as a bug.
  const slides = React.useMemo(
    () => (doc.slides ?? []).filter((slide) => (slide.blocks ?? []).length > 0),
    [doc.slides],
  );

  const [index, setIndex] = React.useState(0);
  const last = Math.max(slides.length - 1, 0);

  const goPrev = React.useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const goNext = React.useCallback(() => {
    setIndex((i) => Math.min(i + 1, last));
  }, [last]);

  useArrowKeyNav(goPrev, goNext);

  if (slides.length === 0) {
    return (
      <Stage onClose={onClose}>
        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
          <p>This lesson has no slides yet.</p>
        </div>
      </Stage>
    );
  }

  const slide = slides[Math.min(index, last)];

  return (
    <Stage onClose={onClose} hideWordmark={!showsBrand(doc, slide)}>
      <Projector>
        <SlideView slide={slide} audience="student" />
      </Projector>

      {/* Controls sit on the slide rather than in a bar, so the stage keeps the
          proportions the projector had. */}
      <nav className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-4 pb-6">
        <SlideNavButton
          label="Previous slide"
          onClick={goPrev}
          disabled={index === 0}
        >
          <ChevronLeftIcon className="size-5" />
        </SlideNavButton>
        <span className="min-w-16 text-center text-sm tabular-nums text-muted-foreground">
          {index + 1} / {slides.length}
        </span>
        <SlideNavButton
          label="Next slide"
          onClick={goNext}
          disabled={index === last}
        >
          <ChevronRightIcon className="size-5" />
        </SlideNavButton>
      </nav>
    </Stage>
  );
}

/** The deck's design size. A slide is laid out at these dimensions and then
 *  scaled as one piece, so 1280x720 is a coordinate system rather than a
 *  measurement of anybody's screen — the same one the presenter's own stage
 *  works out to on a laptop. */
const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;

/**
 * A slide at its own size, scaled to fit whatever screen it is being read on.
 *
 * The presenter can lay a slide out fluidly because its screen is always a
 * projector: wide, landscape, roughly 16:9. A phone is none of those, and
 * letting the same slide reflow into a tall narrow box does not give you a
 * smaller version of what was on the wall — it gives you a different document,
 * with the two-column layouts stacked and the type in the wrong proportion to
 * everything around it.
 *
 * So the slide is built at a fixed 1280x720 and the whole box is scaled with a
 * transform, which is the one operation that keeps every proportion inside it
 * exactly as it was. It is positioned from the centre rather than laid out in
 * flow, because a transform does not change the space an element takes: a
 * 1280px-wide box centred by flexbox in a 360px window overflows both edges, and
 * where the browser clips that is not something to leave to chance.
 */
function Projector({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // 0 until measured — the alternative is one frame of an unscaled slide, which
  // on a phone is the deck at four times the width of the screen.
  const [scale, setScale] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    // The insets are the chrome's: the brand mark above, the controls below.
    // Measuring the space the slide may actually have is what stops it being
    // scaled to fit a box it then sits half-underneath.
    <div ref={ref} className="absolute inset-x-4 bottom-20 top-20">
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          // Nothing to see before the first measurement, and nothing to animate
          // into: the deck opens at the size it will stay at.
          visibility: scale === 0 ? "hidden" : "visible",
        }}
      >
        {/* `relative` for the same reason the presenter's stage is: a wallpaper
            image block anchors a full-bleed background to it. */}
        <div className="relative h-full w-full">{children}</div>
      </div>
    </div>
  );
}

/** The projector surface itself: the full-screen ground, the brand mark and the
 *  way out. Shared by the deck and by every state that has no deck to show, so
 *  a slow fetch or a missing document lands on the same screen the slides do
 *  rather than flashing a different one. */
function Stage({
  onClose,
  hideWordmark = false,
  children,
}: {
  onClose: () => void;
  /** Drop the brand mark — an Advanced Context slide carries the wordmark in
   *  its own corner lockup, and two of them is one too many. */
  hideWordmark?: boolean;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind must not scroll while the deck is open.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lesson slides"
      className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground"
    >
      {/* Brand mark, as on the projector — the deck should look like the one the
          class was taught from, hidden on the same slides. */}
      {!hideWordmark && <BrandMark />}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close slides"
        title="Close slides (Esc)"
        className="absolute right-4 top-4 z-20 inline-flex items-center justify-center rounded-full bg-card/80 p-2.5 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
      >
        <XIcon className="size-5" />
      </button>

      {children}
    </div>
  );
}

function SlideNavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-card/80 p-2.5 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}
