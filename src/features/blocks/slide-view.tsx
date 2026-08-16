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

/** A full-bleed image marked as the slide's wallpaper background. */
function isWallpaper(block: LessonBlock): boolean {
  return block.type === "image" && block.wallpaper === true;
}

/**
 * Blocks that own the whole slide instead of sitting in its column: the
 * wallpaper image and the title cover. Both are lifted out of the flow and
 * stacked edge-to-edge in the order they were authored — which is what lets a
 * title (colour "clear") be laid over a wallpaper photo.
 */
function isFullBleed(block: LessonBlock): boolean {
  return isWallpaper(block) || block.type === "title";
}

/**
 * Read-only render of a whole slide — the presenter's slide surface (both the
 * projected display and the teacher's control device). Teacher-only blocks are
 * shown only when `audience` is "teacher".
 *
 * A slide may declare `layout: "row"` to place its blocks side by side (e.g.
 * text next to an image) instead of stacked, and may carry full-bleed blocks — a
 * `wallpaper` image, a title cover — which are lifted out of the flow and
 * stacked edge-to-edge with the remaining blocks laid on top. Full-bleed mode
 * anchors to the nearest positioned ancestor, so the surfaces that mount
 * `SlideView` (present / control routes) wrap it in a `relative` container.
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

  const header = slide.hideStage ? null : (
    <header className="flex items-center gap-2.5">
      <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-primary" />
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {slide.stage}
      </p>
    </header>
  );

  const blockList = (
    <div
      className={cn(
        "flex",
        isRow ? "flex-row items-center gap-10" : "flex-col gap-8",
      )}
    >
      {blocks.map((block, i) => (
        <div key={i} className={cn(isRow && "min-w-0 flex-1")}>
          <BlockView block={block} audience={audience} />
        </div>
      ))}
    </div>
  );

  if (layers.length > 0) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden">
        {layers.map((layer, i) => (
          <div key={i} className="absolute inset-0">
            <BlockView block={layer} audience={audience} />
          </div>
        ))}
        {blocks.length > 0 && (
          <div className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-8 px-16 py-16">
            {blockList}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {header}
      {blockList}
    </div>
  );
}
