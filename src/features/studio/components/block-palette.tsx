import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_METAS, type BlockType } from "@/features/blocks";
import type { EditorSlide } from "../model";

export function BlockPalette({
  slides,
  activeKey,
  onAddBlock,
  onAddSlide,
  onSelectSlide,
}: {
  slides: EditorSlide[];
  activeKey: string | null;
  onAddBlock: (type: BlockType) => void;
  onAddSlide: () => void;
  onSelectSlide: (key: string) => void;
}) {
  const active = slides.find((s) => s.key === activeKey) ?? slides[0];

  return (
    <aside className="sticky top-20 flex max-h-[calc(100svh-6rem)] w-64 shrink-0 flex-col gap-5 overflow-y-auto pb-8">
      {/* Add block */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add block
        </p>
        {active && (
          <p className="mb-2 truncate text-xs text-muted-foreground">
            → to{" "}
            <span className="font-medium text-foreground">
              {active.meta.stage || "current slide"}
            </span>
          </p>
        )}
        <div className="grid grid-cols-1 gap-1.5">
          {BLOCK_METAS.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.type}
                type="button"
                onClick={() => onAddBlock(b.type)}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-4">
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{b.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide outline */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Slides
        </p>
        <ol className="space-y-0.5">
          {slides.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelectSlide(s.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  s.key === activeKey && "bg-accent font-medium",
                )}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate">
                  {s.meta.stage || (
                    <span className="text-muted-foreground/60">Untitled</span>
                  )}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.blocks.length}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onAddSlide}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          Add slide
        </button>
      </div>
    </aside>
  );
}
