import {
  ChevronDownIcon,
  ChevronUpIcon,
  Columns2Icon,
  CopyIcon,
  LayoutPanelLeftIcon,
  PlusIcon,
  Rows2Icon,
  Trash2Icon,
} from "lucide-react";
import type { ContainerBlock, LessonBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BlockDefinition, BlockEditorProps, BlockViewProps } from "../types";
import type { Audience, BlockType } from "../types";
import { IconAction } from "../editor-ui/primitives";
import { Segmented } from "../editor-ui/segmented";
// The registry imports this module and this module reads the registry. Fine:
// both only touch it inside a render, long after both modules have loaded.
import { BLOCK_ORDER, BLOCK_REGISTRY, blockMetas, createBlock } from "../registry";

/**
 * What a container may hold: every presentation block except another cover, and
 * except itself — which is allowed, but not from the palette, so that a nested
 * row of columns is a decision rather than an accident of clicking. A title
 * or can-do block owns the stage and has no meaning inside a column.
 */
export function containerChildTypes(): BlockType[] {
  return BLOCK_ORDER.filter(
    (t) => t !== "title" && t !== "can-do" && t !== "container",
  );
}

const GAP: Record<NonNullable<ContainerBlock["gap"]>, string> = {
  sm: "gap-4",
  md: "gap-8",
  lg: "gap-12",
};

/**
 * The layout classes for a container's children, shared by the view and by the
 * editor's own preview of the arrangement. A row gives each child an equal
 * share; a column stacks them at full width.
 */
export function containerLayout(block: ContainerBlock): string {
  const row = block.direction === "row";
  const centered = block.align === "center";
  return cn(
    "flex",
    GAP[block.gap ?? "md"],
    row ? "flex-row" : "flex-col",
    row
      ? centered
        ? "items-center"
        : "items-start"
      : centered
        ? "items-center"
        : "items-stretch",
  );
}

function View({ block, audience }: BlockViewProps<ContainerBlock>) {
  const row = block.direction === "row";
  const visible = block.blocks.filter(
    (b) => audience === "teacher" || b.audience !== "teacher",
  );
  return (
    <div className={containerLayout(block)}>
      {visible.map((child, i) => {
        const Child = BLOCK_REGISTRY[child.type]
          .View as React.FC<BlockViewProps<LessonBlock>>;
        return (
          <div key={i} className={cn(row ? "min-w-0 flex-1" : "w-full")}>
            <Child block={child} audience={audience as Audience} />
          </div>
        );
      })}
    </div>
  );
}

/** Swap two neighbours; the array comes back untouched at either end. */
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function AddChildMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          Add to container
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Add block</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {blockMetas(containerChildTypes()).map((b) => {
          const Icon = b.icon;
          return (
            <DropdownMenuItem key={b.type} onSelect={() => onAdd(b.type)}>
              <Icon className="text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{b.label}</span>
                <span className="text-xs text-muted-foreground">{b.hint}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAdd("container")}>
          <LayoutPanelLeftIcon className="text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Nested container</span>
            <span className="text-xs text-muted-foreground">
              A row inside a column, or the reverse
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One child, with its own editor and the same hover toolbar a top-level block
 * has — minus the teacher/wallpaper pills, which are top-level concerns (see the
 * note on `ContainerBlock`).
 */
function ChildEditor({
  block,
  isFirst,
  isLast,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: LessonBlock;
  isFirst: boolean;
  isLast: boolean;
  onChange: (b: LessonBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const def = BLOCK_REGISTRY[block.type];
  const Editor = def.Editor as React.FC<BlockEditorProps<LessonBlock>>;
  const Icon = def.meta.icon;
  return (
    <div className="group/child rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-background/60">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3" />
          {def.meta.label}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/child:opacity-100">
          <IconAction onClick={() => onMove(-1)} label="Move up">
            <ChevronUpIcon className={cn(isFirst && "opacity-30")} />
          </IconAction>
          <IconAction onClick={() => onMove(1)} label="Move down">
            <ChevronDownIcon className={cn(isLast && "opacity-30")} />
          </IconAction>
          <IconAction onClick={onDuplicate} label="Duplicate">
            <CopyIcon />
          </IconAction>
          <IconAction onClick={onDelete} label="Delete" variant="danger">
            <Trash2Icon />
          </IconAction>
        </div>
      </div>
      <Editor block={block} onChange={onChange} />
    </div>
  );
}

function Editor({ block, onChange }: BlockEditorProps<ContainerBlock>) {
  const row = block.direction === "row";
  const setBlocks = (blocks: LessonBlock[]) => onChange({ ...block, blocks });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={block.direction ?? "column"}
          onChange={(direction) => onChange({ ...block, direction })}
          options={[
            { value: "column", label: "Column", icon: Rows2Icon },
            { value: "row", label: "Row", icon: Columns2Icon },
          ]}
        />
        <Segmented
          value={block.align ?? "start"}
          onChange={(align) => onChange({ ...block, align })}
          options={[
            { value: "start", label: row ? "Top" : "Left" },
            { value: "center", label: "Center" },
          ]}
        />
        <Segmented
          value={block.gap ?? "md"}
          onChange={(gap) => onChange({ ...block, gap })}
          options={[
            { value: "sm", label: "Tight" },
            { value: "md", label: "Normal" },
            { value: "lg", label: "Loose" },
          ]}
        />
      </div>

      {/* The children are edited in the arrangement they'll be shown in, so a
          row reads as a row here too — at the editor's width, not the stage's,
          but the shape is the thing being decided. */}
      <div
        className={cn(
          "rounded-lg border border-dashed border-primary/30 bg-primary/[0.02] p-2",
          block.blocks.length > 0 && containerLayout(block),
          block.blocks.length > 0 && "!gap-2",
        )}
      >
        {block.blocks.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Empty container
          </p>
        ) : (
          block.blocks.map((child, i) => (
            <div key={i} className={cn(row ? "min-w-0 flex-1" : "w-full")}>
              <ChildEditor
                block={child}
                isFirst={i === 0}
                isLast={i === block.blocks.length - 1}
                onChange={(next) =>
                  setBlocks(block.blocks.map((b, j) => (j === i ? next : b)))
                }
                onMove={(dir) => setBlocks(move(block.blocks, i, dir))}
                onDuplicate={() => {
                  const copy = block.blocks.slice();
                  copy.splice(i + 1, 0, structuredClone(child));
                  setBlocks(copy);
                }}
                onDelete={() =>
                  setBlocks(block.blocks.filter((_, j) => j !== i))
                }
              />
            </div>
          ))
        )}
      </div>

      <AddChildMenu
        onAdd={(type) => setBlocks([...block.blocks, createBlock(type)])}
      />
    </div>
  );
}

export const containerBlock: BlockDefinition<ContainerBlock> = {
  meta: {
    type: "container",
    label: "Container",
    hint: "Group blocks in a row or a column",
    icon: LayoutPanelLeftIcon,
  },
  create: () => ({ type: "container", direction: "column", blocks: [] }),
  View,
  Editor,
};
