import * as React from "react";

import type { BlockType } from "@/features/blocks";
import { cn } from "@/lib/utils";
import type { EditorSlide } from "../model";

import { BlockPalette } from "./block-palette";
import { RawJsonDrawer } from "./raw-json-drawer";
import { SlideCard } from "./slide-card";
import { SlideOutline } from "./slide-outline";
import { StudioToolbar } from "./studio-toolbar";
import type { StudioController } from "../use-studio-lesson";

/**
 * Whether slide previews are drawn, remembered across documents and sessions.
 *
 * A preference about how to work, not about what is being worked on — an author
 * who wants the pictures wants them in every deck they open, and one editing on
 * a laptop who wants the compact list wants that everywhere too.
 */
const PREVIEW_KEY = "studio:slide-preview";

function readPreviewPreference(): boolean {
  try {
    return window.localStorage.getItem(PREVIEW_KEY) !== "off";
  } catch {
    // Private mode, blocked storage — the preference is a nicety, not a reason
    // to fail to open the editor.
    return true;
  }
}

/**
 * The editing surface, minus anything that depends on what is being edited.
 *
 * Slides, blocks, the two rails and the JSON drawer are identical for a
 * presentation, a student material and a homework — they are all the same
 * document shape. The two things that aren't identical arrive as slots: the meta
 * editor above the slides (`meta`), and the kind-specific toolbar buttons
 * (`actions`).
 *
 * Owning `rawOpen` here rather than in the routes is what keeps the JSON toggle
 * and the drawer it opens from being wired up three times.
 */
export function StudioCanvas({
  studio,
  label,
  meta,
  actions,
  onSave,
  saveLabel,
  canSave,
  teacherContent = true,
  blockTypes,
  railLayout = "split",
  slideLocked,
  drawer,
  drawerLabel = "Assistant",
  drawerWidth = "lg:w-[26rem] xl:w-[30rem]",
  drawerPadding = "lg:pr-[26rem] xl:pr-[30rem]",
  portable = true,
  back,
  compact = false,
  menuItems,
}: {
  studio: StudioController;
  label: string;
  meta: React.ReactNode;
  actions?: React.ReactNode;
  onSave: () => Promise<void>;
  saveLabel?: string;
  canSave?: boolean;
  /** False for the student-facing kinds, which hides teacher notes, the
   *  teacher-only block toggle and the class-planning fields. */
  teacherContent?: boolean;
  /** Which block types the palette offers; defaults to all of them. */
  blockTypes?: BlockType[];
  /** "split" puts the palette and the outline on facing rails — the default, and
   *  the roomier of the two. "stacked" moves both to the left so the right-hand
   *  side is free for `drawer`. */
  railLayout?: "split" | "stacked";
  /** Which slides can only be added to, not changed. The Advanced Context Studio
   *  passes the base material here; everything else leaves it undefined and
   *  every slide stays editable. */
  slideLocked?: (slide: EditorSlide) => boolean;
  /** A panel that slides in from the right, toggled from the toolbar. */
  drawer?: React.ReactNode;
  drawerLabel?: string;
  /** Spelled out as literal class strings rather than interpolated: Tailwind
   *  only ships the classes it can see in the source. */
  drawerWidth?: string;
  drawerPadding?: string;
  /** False hides Copy and Export — see `portable` on StudioToolbar. */
  portable?: boolean;
  /** Overrides the top-left button — see `back` on StudioToolbar. */
  back?: { label: string; onClick: () => void };
  /** Collapse the toolbar's right side to three icons — see `compact` on
   *  StudioToolbar. */
  compact?: boolean;
  /** `DropdownMenuItem`s for the compact toolbar's menu. */
  menuItems?: React.ReactNode;
}) {
  const { lesson } = studio;

  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);
  const [preview, setPreview] = React.useState(readPreviewPreference);
  // Open from the start when there is one: a drawer you have to find is a drawer
  // nobody uses, and the editor that has one is the editor that is about it.
  const [drawerOpen, setDrawerOpen] = React.useState(!!drawer);

  const togglePreview = () =>
    setPreview((on) => {
      const next = !on;
      try {
        window.localStorage.setItem(PREVIEW_KEY, next ? "on" : "off");
      } catch {
        // Not being able to remember it is not a reason not to do it.
      }
      return next;
    });

  // The active slide, derived so a deleted/stale key falls back to the first
  // slide without an effect. `setActiveKey` is only ever driven by user intent.
  const targetKey =
    activeKey && lesson.slides.some((s) => s.key === activeKey)
      ? activeKey
      : (lesson.slides[0]?.key ?? null);

  const handleAddSlide = () => {
    const key = studio.addSlide(targetKey ?? undefined);
    setActiveKey(key);
    requestAnimationFrame(() => {
      document
        .getElementById(`slide-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSelectSlide = (key: string) => {
    setActiveKey(key);
    document
      .getElementById(`slide-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stacked = railLayout === "stacked";

  const palette = (
    <BlockPalette
      slides={lesson.slides}
      activeKey={targetKey}
      blockTypes={blockTypes}
      stacked={stacked}
      onAddBlock={(type) => {
        if (targetKey) studio.addBlock(targetKey, type);
      }}
    />
  );

  const outline = (
    <SlideOutline
      slides={lesson.slides}
      activeKey={targetKey}
      stacked={stacked}
      onAddSlide={handleAddSlide}
      onSelectSlide={handleSelectSlide}
    />
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div
        className={cn(
          "transition-[padding] duration-200",
          drawer && drawerOpen && drawerPadding,
        )}
      >
        <StudioToolbar
          document={studio.document}
          label={label}
          onSave={onSave}
          saveLabel={saveLabel}
          canSave={canSave}
          onToggleRaw={() => setRawOpen((v) => !v)}
          rawOpen={rawOpen}
          onTogglePreview={togglePreview}
          previewOn={preview}
          drawerLabel={drawer ? drawerLabel : undefined}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          portable={portable}
          back={back}
          compact={compact}
          menuItems={menuItems}
        >
          {actions}
        </StudioToolbar>

        <div className="mx-auto flex w-full max-w-[84rem] gap-6 px-4 py-6">
          {/* Rails. Split: blocks here, outline across the canvas. Stacked: both
              here, blocks on top — the deck list is the thing you scroll, so it
              takes the bottom half where a scrollbar costs nothing. */}
          {stacked ? (
            <aside className="sticky top-20 hidden max-h-[calc(100svh-6rem)] w-56 shrink-0 flex-col gap-5 lg:flex">
              {palette}
              {outline}
            </aside>
          ) : (
            palette
          )}

          {/* Canvas */}
          <div className="min-w-0 flex-1 space-y-4">
            {meta}

            {lesson.slides.map((slide, i) => (
              <div
                key={slide.key}
                onFocusCapture={() => setActiveKey(slide.key)}
                onMouseDown={() => setActiveKey(slide.key)}
              >
                <SlideCard
                  slide={slide}
                  index={i}
                  total={lesson.slides.length}
                  studio={studio}
                  teacherContent={teacherContent}
                  preview={preview}
                  blockTypes={blockTypes}
                  locked={slideLocked?.(slide) ?? false}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddSlide}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              + Add slide
            </button>
          </div>

          {!stacked && outline}
        </div>
      </div>

      {/* The drawer, on the same pattern as the student detail rail: fixed to the
          viewport, translated out when shut, and `inert` so nothing inside it is
          tabbable while it is. */}
      {drawer && (
        <aside
          inert={!drawerOpen}
          aria-hidden={!drawerOpen}
          className={cn(
            "fixed right-0 top-0 z-40 flex h-[100dvh] w-full flex-col border-l bg-popover transition-transform duration-200",
            drawerWidth,
            !drawerOpen && "translate-x-full",
          )}
        >
          {drawer}
        </aside>
      )}

      <RawJsonDrawer
        open={rawOpen}
        document={studio.document}
        onClose={() => setRawOpen(false)}
        onApply={studio.load}
      />
    </div>
  );
}
