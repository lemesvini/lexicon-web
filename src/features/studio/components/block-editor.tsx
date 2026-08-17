import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  Trash2Icon,
} from "lucide-react";
import type { LessonBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import {
  BLOCK_REGISTRY,
  IconAction,
  isTeacherOnly,
  type BlockEditorProps,
} from "@/features/blocks";

type ImageBlock = Extract<LessonBlock, { type: "image" }>;
function isImage(block: LessonBlock): block is ImageBlock {
  return block.type === "image";
}

/** The registry's Editor for this block, with the discriminated union erased in
 *  one controlled place (runtime `block.type` guarantees the match). */
function BlockBody({
  block,
  onChange,
}: {
  block: LessonBlock;
  onChange: (b: LessonBlock) => void;
}) {
  const Editor = BLOCK_REGISTRY[block.type]
    .Editor as React.FC<BlockEditorProps<LessonBlock>>;
  return <Editor block={block} onChange={onChange} />;
}

export function BlockEditor({
  block,
  isFirst,
  isLast,
  teacherContent = true,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: LessonBlock;
  isFirst: boolean;
  isLast: boolean;
  /** False in a student-facing document, where marking a block "Teacher" would
   *  be offering something the save then silently strips. */
  teacherContent?: boolean;
  onChange: (b: LessonBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const meta = BLOCK_REGISTRY[block.type].meta;
  const Icon = meta.icon;
  const teacherOnly = isTeacherOnly(block);

  return (
    <div
      className={cn(
        "group/block relative rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/30",
        teacherOnly &&
          "border-dashed border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/10",
      )}
    >
      {/* Top row: type pill + hover toolbar */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3" />
          {meta.label}
          {teacherOnly && (
            <span className="ml-1 rounded bg-amber-200/70 px-1 py-px text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
              Teacher only
            </span>
          )}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/block:opacity-100">
          {isImage(block) && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  wallpaper: block.wallpaper ? undefined : true,
                })
              }
              className={cn(
                "mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                block.wallpaper
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Wallpaper
            </button>
          )}
          {teacherContent && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  audience: teacherOnly ? undefined : "teacher",
                })
              }
              className={cn(
                "mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                teacherOnly
                  ? "bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Teacher
            </button>
          )}
          <IconAction onClick={() => onMove(-1)} label="Move up">
            <ChevronUpIcon className={cn(isFirst && "opacity-30")} />
          </IconAction>
          <IconAction onClick={() => onMove(1)} label="Move down">
            <ChevronDownIcon className={cn(isLast && "opacity-30")} />
          </IconAction>
          <IconAction onClick={onDuplicate} label="Duplicate block">
            <CopyIcon />
          </IconAction>
          <IconAction onClick={onDelete} label="Delete block" variant="danger">
            <Trash2Icon />
          </IconAction>
        </div>
      </div>

      <BlockBody block={block} onChange={onChange} />
    </div>
  );
}
