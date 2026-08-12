import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getLesson } from "@/lib/lessons";
import { useStudioLesson } from "@/features/studio/use-studio-lesson";
import { StudioToolbar } from "@/features/studio/components/studio-toolbar";
import { RawJsonDrawer } from "@/features/studio/components/raw-json-drawer";
import { LessonMetaEditor } from "@/features/studio/components/lesson-meta-editor";
import { BlockPalette } from "@/features/studio/components/block-palette";
import { SlideCard } from "@/features/studio/components/slide-card";

type StudioSearch = { lessonId?: string };

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    lessonId:
      typeof search.lessonId === "string" ? search.lessonId : undefined,
  }),
  component: StudioPage,
});

function StudioPage() {
  const { lessonId } = Route.useSearch();
  const studio = useStudioLesson();
  const { lesson, load } = studio;

  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);

  // Deep-link: /studio?lessonId=... loads that existing situation once.
  const loadedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (lessonId && loadedRef.current !== lessonId) {
      const doc = getLesson(lessonId);
      if (doc) {
        load(doc);
        loadedRef.current = lessonId;
      }
    }
  }, [lessonId, load]);

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
        onLoad={load}
        onNew={studio.reset}
        onToggleRaw={() => setRawOpen((v) => !v)}
        rawOpen={rawOpen}
      />

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        {/* Canvas */}
        <div className="min-w-0 flex-1 space-y-4">
          <LessonMetaEditor meta={lesson.meta} onChange={studio.updateMeta} />

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
        onApply={load}
      />
    </div>
  );
}
