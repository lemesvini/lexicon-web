import {
  ChevronDownIcon,
  ChevronUpIcon,
  Columns2Icon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PlusIcon,
  Rows2Icon,
  Trash2Icon,
} from "lucide-react";
import type { LessonBlock, LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/features/blocks";
import type { EditorSlide } from "../model";
import type { StudioController } from "../use-studio-lesson";
import { AddBlockMenu } from "./add-block-menu";
import { BlockEditor } from "./block-editor";
import {
  AddRowButton,
  AutoTextarea,
  DeleteRowButton,
  IconAction,
} from "@/features/blocks";

function TeacherNotes({
  notes,
  onChange,
}: {
  notes: string[];
  onChange: (notes: string[]) => void;
}) {
  const set = (i: number, v: string) =>
    onChange(notes.map((n, ni) => (ni === i ? v : n)));
  return (
    <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Teacher notes
      </p>
      <div className="space-y-1.5">
        {notes.map((note, i) => (
          <div key={i} className="group/note flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <AutoTextarea
              value={note}
              onValueChange={(v) => set(i, v)}
              placeholder="Note to self for this slide…"
              className="text-sm text-muted-foreground"
            />
            <span className="opacity-0 transition-opacity group-hover/note:opacity-100">
              <DeleteRowButton
                onClick={() => onChange(notes.filter((_, ni) => ni !== i))}
                label="Remove note"
              />
            </span>
          </div>
        ))}
      </div>
      <AddRowButton onClick={() => onChange([...notes, ""])} label="Add note" />
    </div>
  );
}

export function SlideCard({
  slide,
  index,
  total,
  studio,
}: {
  slide: EditorSlide;
  index: number;
  total: number;
  studio: StudioController;
}) {
  const { key, meta, blocks } = slide;
  const setMeta = (patch: Partial<Omit<LessonSlide, "blocks">>) =>
    studio.updateSlideMeta(key, patch);
  const isRow = meta.layout === "row";

  return (
    <section
      id={`slide-${key}`}
      className="scroll-mt-24 rounded-xl border bg-card shadow-sm"
    >
      {/* Slide header */}
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2 pt-0.5">
          <GripVerticalIcon className="size-4 text-muted-foreground/40" />
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <input
            value={meta.stage}
            onChange={(e) => setMeta({ stage: e.target.value })}
            placeholder="Stage name (e.g. Warm-up)"
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-1.5">
              <span className="text-xs">id</span>
              <input
                value={meta.id}
                onChange={(e) => setMeta({ id: e.target.value })}
                placeholder="slide-id"
                className="w-28 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-xs">⏱</span>
              <input
                value={meta.duration}
                onChange={(e) => setMeta({ duration: e.target.value })}
                placeholder="10 min"
                className="w-16 bg-transparent outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <input
              value={meta.goal}
              onChange={(e) => setMeta({ goal: e.target.value })}
              placeholder="Goal of this slide…"
              className="min-w-40 flex-1 bg-transparent italic outline-none placeholder:not-italic placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {/* Slide actions + the top-right add button */}
        <div className="flex shrink-0 items-center gap-0.5">
          <IconAction
            onClick={() => setMeta({ hideStage: !meta.hideStage })}
            label={
              meta.hideStage
                ? "Stage header hidden — click to show"
                : "Stage header shown — click to hide"
            }
          >
            {meta.hideStage ? <EyeOffIcon /> : <EyeIcon />}
          </IconAction>
          <IconAction
            onClick={() => setMeta({ layout: isRow ? "column" : "row" })}
            label={
              isRow
                ? "Layout: side by side — click to stack"
                : "Layout: stacked — click for side by side"
            }
          >
            {isRow ? <Columns2Icon /> : <Rows2Icon />}
          </IconAction>
          <IconAction onClick={() => studio.moveSlide(key, -1)} label="Move slide up">
            <ChevronUpIcon className={cn(index === 0 && "opacity-30")} />
          </IconAction>
          <IconAction
            onClick={() => studio.moveSlide(key, 1)}
            label="Move slide down"
          >
            <ChevronDownIcon className={cn(index === total - 1 && "opacity-30")} />
          </IconAction>
          <IconAction onClick={() => studio.duplicateSlide(key)} label="Duplicate slide">
            <CopyIcon />
          </IconAction>
          <IconAction
            onClick={() => studio.removeSlide(key)}
            label="Delete slide"
            variant="danger"
          >
            <Trash2Icon />
          </IconAction>
          <span className="ml-1">
            <AddBlockMenu onAdd={(type) => studio.addBlock(key, type)} />
          </span>
        </div>
      </header>

      {/* Blocks */}
      <div className="space-y-1 px-3 py-3">
        {blocks.length === 0 ? (
          <EmptySlide onAdd={(type) => studio.addBlock(key, type)} />
        ) : (
          blocks.map((block, i) => (
            <BlockEditor
              key={block.key}
              block={block.data}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              onChange={(data: LessonBlock) =>
                studio.updateBlock(key, block.key, data)
              }
              onMove={(dir) => studio.moveBlock(key, block.key, dir)}
              onDuplicate={() => studio.duplicateBlock(key, block.key)}
              onDelete={() => studio.removeBlock(key, block.key)}
            />
          ))
        )}
      </div>

      <div className="px-5 pb-5">
        <TeacherNotes
          notes={meta.teacherNotes ?? []}
          onChange={(notes) => setMeta({ teacherNotes: notes })}
        />
      </div>
    </section>
  );
}

function EmptySlide({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
      <p className="text-sm text-muted-foreground">No blocks yet</p>
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <PlusIcon className="size-3.5" />
        Use the <span className="font-medium">+</span> in the corner or the
        palette to add a block
      </div>
      <button
        type="button"
        onClick={() => onAdd("text")}
        className="mt-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent text-muted-foreground"
      >
        Add a text block
      </button>
    </div>
  );
}
