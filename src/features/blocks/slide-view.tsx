import type { LessonBlock, LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { Audience, BlockViewProps } from "./types";
import { BLOCK_REGISTRY, isTeacherOnly } from "./registry";
import { FOREST, INK, JADE, MIST, SAND, withAlpha } from "./brand";

/** Read-only render of a single block, dispatched through the registry. This is
 *  the one place the discriminated union is erased — the runtime `block.type`
 *  guarantees the block matches its definition's `View`. */
export function BlockView({ block, audience }: BlockViewProps<LessonBlock>) {
  const View = BLOCK_REGISTRY[block.type]
    .View as React.FC<BlockViewProps<LessonBlock>>;
  return <View block={block} audience={audience} />;
}

/**
 * The two ways an advanced-context frame is painted.
 *
 * Brand colours rather than theme tokens, for the reason `brand.ts` exists: this
 * is projected. The room should see the same frame whichever theme the teacher's
 * laptop happens to be in.
 */
const ADVANCED_THEMES = {
  /** Brand green ground, dark panel. */
  jade: { ground: JADE, panel: INK, accent: JADE, ink: SAND, mark: INK },
  /** Dark ground, pale panel. */
  forest: { ground: INK, panel: MIST, accent: FOREST, ink: INK, mark: MIST },
} as const;

export type AdvancedTheme = keyof typeof ADVANCED_THEMES;

/**
 * Every measurement of the frame, in one place and one unit system per mode.
 *
 * The stage is whatever the projector is — a laptop panel, a 4K TV, a preview
 * card in the drawer — so nothing here is a fixed pixel count. In `fill` the
 * numbers are `clamp(min, vw, max)`: the frame breathes with the screen, and the
 * padding, the corner radii and the type all move together, which is what keeps
 * the proportions the same at 1280px and at 3840px instead of leaving a tiny
 * wordmark stranded in a huge margin. The inner radius is derived from the outer
 * one minus the hairline's inset, so the two curves stay concentric — the detail
 * you don't notice until it's wrong.
 */
const METRICS = {
  fill: {
    pad: "clamp(1rem, 2.4vw, 2.75rem)",
    gap: "clamp(0.5rem, 1.05vw, 1.15rem)",
    wordmark: "clamp(1.35rem, 2.9vw, 3rem)",
    label: "clamp(0.7rem, 1.25vw, 1.35rem)",
    radius: "clamp(1rem, 2.1vw, 2.25rem)",
    hairline: "clamp(0.4rem, 0.75vw, 0.85rem)",
    inner: "clamp(1.5rem, 4.4vw, 4.5rem)",
  },
  panel: {
    pad: "0.75rem",
    gap: "0.5rem",
    wordmark: "1rem",
    label: "0.625rem",
    radius: "1rem",
    hairline: "0.375rem",
    inner: "1.25rem",
  },
} as const;

/**
 * The theme tokens the blocks inside a frame read, repointed at the frame's own
 * palette.
 *
 * Setting `color` alone would only fix the copy that inherits `currentColor`. A
 * block's label is `text-muted-foreground` and a note's rule is `border-border` —
 * both resolve to `var(--…)`, so on a dark panel in a light-themed app they come
 * out dark on dark and vanish. Overriding the variables at the frame is what makes
 * every block legible without any block knowing it is in one.
 */
function frameTokens(ink: string): React.CSSProperties {
  return {
    color: ink,
    "--foreground": ink,
    "--card-foreground": ink,
    "--popover-foreground": ink,
    "--muted-foreground": withAlpha(ink, 0.65),
    "--border": withAlpha(ink, 0.2),
    "--input": withAlpha(ink, 0.2),
  } as React.CSSProperties;
}

/**
 * The frame around what one group added on top of the shared lesson.
 *
 * Saying so once is the whole point: in a room being shown a lesson every other
 * class also gets, the teacher needs to see at a glance which part is theirs —
 * and a slide of three blocks announcing "Advanced Context" three times says it
 * less clearly than saying it once around all of them.
 *
 * The layout is a column, not a stack of absolute boxes: a header row on the
 * brand ground, then the panel taking whatever is left. That ordering is what
 * makes the centring honest — the blocks are centred in the panel, and the panel
 * is what remains once the header has taken its space, so nothing is ever
 * optically pushed low by a wordmark floating over it.
 *
 * `fill` is the difference between a panel and a slide. On a slide that is
 * entirely a group's own the frame IS the slide — it takes the whole stage the
 * way a wallpaper does, anchored to the same `relative` container the full-bleed
 * layers use, so the border is the slide's own edge rather than a box drawn
 * inside it. Off, it is a panel sized to its content: what the drawer's preview
 * cards want, and what a lone added block on a base slide wants.
 *
 * The blocks inside need no knowledge of any of this: `frameTokens` repoints the
 * theme variables they already read at the frame's own palette.
 */
export function AdvancedFrame({
  theme = "jade",
  fill = false,
  children,
}: {
  theme?: AdvancedTheme;
  /** Take the whole stage, as the slide's own border. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  const colors = ADVANCED_THEMES[theme];
  const m = fill ? METRICS.fill : METRICS.panel;

  return (
    <div
      className={cn(
        "flex flex-col",
        fill ? "absolute inset-0 overflow-hidden" : "relative rounded-2xl",
      )}
      style={{ backgroundColor: colors.ground, padding: m.pad, gap: m.gap }}
    >
      {/* The stage's own header, on the brand ground rather than over the panel.
          In fill mode it stands in for the presenter's wordmark — two on one
          slide would be one too many. Flush with the panel's outer edge on both
          sides, so the left margins line up down the slide and so do the right. */}
      <header className="flex shrink-0 items-baseline justify-between gap-4">
        <p
          className="font-display lowercase leading-none tracking-tight"
          style={{ fontSize: m.wordmark, color: colors.mark }}
        >
          lexicon
        </p>
        <p
          className="font-montserrat leading-none"
          style={{ fontSize: m.label, color: withAlpha(colors.mark, 0.85) }}
        >
          Advanced Context
        </p>
      </header>

      {/* The panel — everything the header left over. */}
      <div
        className={cn("relative", fill && "min-h-0 flex-1")}
        style={{
          backgroundColor: colors.panel,
          borderRadius: m.radius,
          ...frameTokens(colors.ink),
        }}
      >
        {/* A hairline of the accent inside the panel — the detail that keeps a
            big flat rectangle from reading as a hole cut in the slide. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: m.hairline,
            borderRadius: `calc(${m.radius} - ${m.hairline})`,
            border: `1px solid ${withAlpha(colors.accent, 0.55)}`,
          }}
        />

        <div
          className={cn(
            "relative flex items-center justify-center",
            fill && "h-full",
          )}
          style={{ padding: m.inner }}
        >
          <div className="w-full max-w-4xl">{children}</div>
        </div>
      </div>
    </div>
  );
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
 * These never get the `AdvancedFrame`: a bordered wallpaper is not a thing, and
 * the frame's padding would break the `absolute inset-0` the layer relies on.
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
          {/* Only on a BASE slide, where a group's addition sits among content
              that isn't theirs and has to be told apart block by block. On an
              advanced slide the frame is around the lot — see below. */}
          {block.advancedContext && !slide.advancedContext ? (
            <AdvancedFrame theme={slide.advancedTheme}>
              <BlockView block={block} audience={audience} />
            </AdvancedFrame>
          ) : (
            <BlockView block={block} audience={audience} />
          )}
        </div>
      ))}
    </div>
  );

  // A slide that is entirely a group's own: the frame takes the whole stage, so
  // the border belongs to the slide rather than sitting on top of it. Returned
  // here rather than folded into the two branches below because it replaces the
  // stage, header and content column all at once.
  if (slide.advancedContext) {
    return (
      <AdvancedFrame theme={slide.advancedTheme} fill>
        {blockList}
      </AdvancedFrame>
    );
  }

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
