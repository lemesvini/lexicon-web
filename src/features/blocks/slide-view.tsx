import type { LessonBlock, LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { Audience, BlockViewProps } from "./types";
import { BLOCK_REGISTRY, isTeacherOnly } from "./registry";

/** Read-only render of a single block, dispatched through the registry. This is
 *  the one place the discriminated union is erased — the runtime `block.type`
 *  guarantees the block matches its definition's `View`. */
export function BlockView({ block, audience }: BlockViewProps<LessonBlock>) {
  const View = BLOCK_REGISTRY[block.type]
    .View as React.FC<BlockViewProps<LessonBlock>>;
  return <View block={block} audience={audience} />;
}

/**
 * The mark that says a slide is one group's own addition.
 *
 * A lockup rather than a frame: the slide keeps the look of every other slide,
 * and the badge in the corner is the only thing that tells the teacher this part
 * is theirs. Saying it once, quietly, beats repainting the whole stage — a
 * re-coloured slide reads to the room as a different kind of content, which it
 * isn't.
 *
 * `corner` hangs it off the stage's top-left, anchored to the same `relative`
 * container the full-bleed layers use (every surface that mounts `SlideView`
 * provides one). Off, it sits inline above a single added block on a base slide,
 * where there is no stage to hang from.
 */
export function AdvancedMark({ corner = false }: { corner?: boolean }) {
  return (
    <img
      src="/advctx.png"
      alt="Advanced Context"
      className={cn(
        "pointer-events-none w-auto select-none",
        corner
          ? "absolute left-8 top-8 z-20 h-[clamp(1.5rem,2.6vw,2.75rem)]"
          : "mb-3 h-5",
      )}
    />
  );
}

/**
 * Whether a slide wears the Advanced Context mark.
 *
 * Exported because the mark is a lockup with "lexicon" already in it: the
 * surfaces that paint the presenter's own wordmark at the top of the stage
 * (present, the studio preview, the student deck) drop it on a marked slide
 * rather than show the brand twice.
 *
 * `advancedTheme: "plain"` is a group saying "this is an ordinary slide" —
 * still theirs, still editable, still carried by a rebase, just not announced as
 * an aside. Anything else (including the legacy frame names) gets the mark.
 */
export function isAdvancedMarked(slide: LessonSlide): boolean {
  return slide.advancedContext === true && slide.advancedTheme !== "plain";
}

/** A full-bleed image marked as the slide's wallpaper background. */
function isWallpaper(block: LessonBlock): boolean {
  return block.type === "image" && block.wallpaper === true;
}

/**
 * Blocks that own the whole slide instead of sitting in its column: the
 * wallpaper image and the title cover. Both are lifted out of the flow and
 * stacked edge-to-edge in the order they were authored — which is what lets a
 * title (colour "clear") be laid over a wallpaper photo.
 *
 * The Advanced Context mark is unaffected: it hangs off the stage's corner, over
 * whatever these layers paint.
 */
function isFullBleed(block: LessonBlock): boolean {
  return (
    isWallpaper(block) ||
    block.type === "title" ||
    (block.type === "embed" && block.fill === true)
  );
}

/** Where the content column sits on the stage, as flex classes on the stage
 *  layer. Exported for the studio's alignment picker, so the options offered are
 *  exactly the ones that render. */
export const SLIDE_ALIGN: Record<NonNullable<LessonSlide["align"]>, string> = {
  top: "items-start",
  middle: "items-center",
  bottom: "items-end",
};
export const SLIDE_JUSTIFY: Record<
  NonNullable<LessonSlide["justify"]>,
  string
> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/**
 * Read-only render of a whole slide — the presenter's slide surface (both the
 * projected display and the teacher's control device). Teacher-only blocks are
 * shown only when `audience` is "teacher".
 *
 * The view is a layer: it fills the nearest positioned ancestor and places the
 * content column inside it according to the slide's `align` / `justify` — the
 * middle by default, a corner when the author wants the room's eye there. The
 * surfaces that mount it (present / control / the studio preview / the student
 * deck) provide a `relative` box of the stage's size and nothing else; the
 * padding around the content is the slide's own, so it is the same on all of
 * them.
 *
 * A slide may declare `layout: "row"` to place its blocks side by side (e.g.
 * text next to an image) instead of stacked — a `container` block puts a column
 * inside that row — and may carry full-bleed blocks — a `wallpaper` image, a
 * title cover — which are lifted out of the flow and stacked edge-to-edge with
 * the remaining blocks laid on top.
 */
export function SlideView({
  slide,
  audience = "student",
}: {
  slide: LessonSlide;
  audience?: Audience;
}) {
  const visible = slide.blocks.filter(
    (b) => audience === "teacher" || !isTeacherOnly(b),
  );
  const layers = visible.filter(isFullBleed);
  const blocks = visible.filter((b) => !isFullBleed(b));
  const isRow = slide.layout === "row";
  const justify = slide.justify ?? "center";

  // No heading over a full-bleed layer: a cover has its own headline, and a
  // photo with a stage title on it reads as a captioned picture, not a slide.
  const header =
    slide.hideStage || !slide.stage || layers.length > 0 ? null : (
      <header>
        <h2
          className={cn(
            "font-montserrat text-4xl font-bold leading-tight tracking-tight text-primary",
            justify === "center" && "text-center",
            justify === "right" && "text-right",
          )}
        >
          {slide.stage}
        </h2>
      </header>
    );

  const blockList = (
    <div
      className={cn(
        "flex",
        isRow ? "flex-row items-start gap-10" : "flex-col gap-8",
      )}
    >
      {blocks.map((block, i) => (
        <div key={i} className={cn(isRow && "min-w-0 flex-1")}>
          {/* Only on a BASE slide, where a group's addition sits among content
              that isn't theirs and has to be told apart block by block. On an
              advanced slide the mark is in the stage's corner — see below. */}
          {block.advancedContext && !slide.advancedContext && <AdvancedMark />}
          <BlockView block={block} audience={audience} />
        </div>
      ))}
    </div>
  );

  // A slide that is entirely a group's own renders like any other slide; the
  // only difference is the mark in the stage's top-left corner.
  const mark = isAdvancedMarked(slide) ? <AdvancedMark corner /> : null;

  // The content column and where it sits. `py-24` leaves room for the wordmark
  // above and nothing in particular below; the two match so "middle" is the
  // middle of the stage, not of what's left under the brand.
  const column = (
    <div
      className={cn(
        "absolute inset-0 z-10 flex px-16 py-24",
        SLIDE_ALIGN[slide.align ?? "middle"],
        SLIDE_JUSTIFY[justify],
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-8",
          isRow ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        {header}
        {blockList}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {mark}
      {layers.map((layer, i) => (
        <div key={i} className="absolute inset-0">
          <BlockView block={layer} audience={audience} />
        </div>
      ))}
      {(blocks.length > 0 || header) && column}
    </div>
  );
}
