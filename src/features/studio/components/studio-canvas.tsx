import * as React from "react";

import type { BlockType } from "@/features/blocks";

import { BlockPalette } from "./block-palette";
import { RawJsonDrawer } from "./raw-json-drawer";
import { SlideCard } from "./slide-card";
import { StudioToolbar } from "./studio-toolbar";
import type { StudioController } from "../use-studio-lesson";

/**
 * The editing surface, minus anything that depends on what is being edited.
 *
 * Slides, blocks, the palette and the JSON drawer are identical for a
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
}) {
  const { lesson } = studio;

  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);

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

  return (
    <div className="min-h-svh bg-background text-foreground">
      <StudioToolbar
        document={studio.document}
        label={label}
        onSave={onSave}
        saveLabel={saveLabel}
        canSave={canSave}
        onToggleRaw={() => setRawOpen((v) => !v)}
        rawOpen={rawOpen}
      >
        {actions}
      </StudioToolbar>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
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
                blockTypes={blockTypes}
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

        {/* Right rail */}
        <BlockPalette
          slides={lesson.slides}
          activeKey={targetKey}
          blockTypes={blockTypes}
          onAddBlock={(type) => {
            if (targetKey) studio.addBlock(targetKey, type);
          }}
          onAddSlide={handleAddSlide}
          onSelectSlide={handleSelectSlide}
        />
      </div>

      <RawJsonDrawer
        open={rawOpen}
        document={studio.document}
        onClose={() => setRawOpen(false)}
        onApply={studio.load}
      />
    </div>
  );
}
