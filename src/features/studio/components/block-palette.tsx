import { BLOCK_ORDER, blockMetas, type BlockType } from "@/features/blocks";
import type { EditorSlide } from "../model";

/**
 * Left rail: the blocks you can drop into the active slide.
 *
 * The slide outline lives in its own rail on the other side ({@link
 * ./slide-outline.tsx}) — stacking the two in one column meant a long deck
 * pushed the block list out of reach behind a scrollbar.
 */
export function BlockPalette({
  slides,
  activeKey,
  blockTypes = BLOCK_ORDER,
  onAddBlock,
}: {
  slides: EditorSlide[];
  activeKey: string | null;
  /** Which block types this editor offers. Homework gets only the exercises. */
  blockTypes?: BlockType[];
  onAddBlock: (type: BlockType) => void;
}) {
  const active = slides.find((s) => s.key === activeKey) ?? slides[0];
  const metas = blockMetas(blockTypes);

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100svh-6rem)] w-56 shrink-0 flex-col lg:flex">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Add block
      </p>
      {active && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          → to{" "}
          <span className="font-medium text-foreground">
            {active.meta.stage || "current slide"}
          </span>
        </p>
      )}

      <div className="no-scrollbar mt-2 grid min-h-0 grid-cols-1 gap-1.5 overflow-y-auto pb-2">
        {metas.map((b) => {
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
    </aside>
  );
}
