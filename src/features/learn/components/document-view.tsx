import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";
import { BlockView } from "@/features/blocks";
import { cn } from "@/lib/utils";

/**
 * A lesson document rendered as a page to read, rather than a deck to project.
 *
 * The student's material shares the presentation's shape (meta + slides + the
 * same blocks), so this is the counterpart to @/features/blocks/slide-view: same
 * blocks, different surface. A slide becomes a section in a scrollable column,
 * which is what a student on a phone actually wants — no fixed 16:9 stage, no
 * one-screen-at-a-time.
 *
 * Nothing here filters for audience. The teacher-only blocks are already gone:
 * they are stripped on write by `strip_teacher_content` (see 0004), so a student
 * document never contains them in the first place.
 */

/** Full-bleed only means something on a projected slide — SlideView lifts those
 *  blocks out of the flow and gives them the whole stage. A page has no stage, so
 *  the flag is dropped and the block renders in the column like any other: a
 *  wallpaper becomes an image, a full-slide embed becomes a 16:9 frame. */
function inFlow(block: LessonBlock): LessonBlock {
  if (block.type === "image" && block.wallpaper)
    return { ...block, wallpaper: false };
  if (block.type === "embed" && block.fill)
    return { ...block, fill: undefined };
  return block;
}

function Section({ slide }: { slide: LessonSlide }) {
  const isRow = slide.layout === "row";

  return (
    <section className="space-y-6">
      {!slide.hideStage && slide.stage && (
        <header className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-4 w-1 shrink-0 rounded-full bg-primary"
          />
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {slide.stage}
          </h2>
        </header>
      )}

      <div
        className={cn(
          "flex flex-col gap-6",
          // Side-by-side is a projector layout; on a narrow screen it stacks.
          isRow && "sm:flex-row sm:items-start sm:gap-8",
        )}
      >
        {slide.blocks.map((block, i) => (
          <div key={i} className={cn(isRow && "min-w-0 flex-1")}>
            <BlockView block={inFlow(block)} audience="student" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DocumentView({ document }: { document: Lesson }) {
  const slides = (document.slides ?? []).filter(
    (slide) => (slide.blocks ?? []).length > 0,
  );

  if (slides.length === 0) {
    return (
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        This lesson has no material yet.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {slides.map((slide, i) => (
        <Section key={slide.id || i} slide={slide} />
      ))}
    </div>
  );
}
