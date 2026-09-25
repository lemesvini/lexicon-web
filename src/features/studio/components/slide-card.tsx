import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import type { Lesson, LessonBlock, LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/features/blocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditorSlide } from "../model";
import type { StudioController } from "../use-studio-lesson";
import { AddBlockMenu } from "./add-block-menu";
import { BlockEditor } from "./block-editor";
import { SlideLayoutPopover } from "./slide-layout-popover";
import { SlidePreview } from "./slide-preview";
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

/**
 * Whether the slide wears the Advanced Context mark, toggled.
 *
 * The slide is the group's own either way — the flag that owns it is
 * `advancedContext`, which this never touches, so switching to plain and back
 * loses nothing and a rebase still carries the slide across. Anything that isn't
 * "plain" (including the frame names old documents carry) is marked.
 */
function nextTheme(
  theme: LessonSlide["advancedTheme"],
): NonNullable<LessonSlide["advancedTheme"]> {
  return theme === "plain" ? "mark" : "plain";
}

export function SlideCard({
  slide,
  lesson,
  index,
  total,
  studio,
  teacherContent = true,
  preview = true,
  locked = false,
  blockTypes,
}: {
  slide: EditorSlide;
  /** The document's defaults the preview needs — the wordmark setting. */
  lesson?: Pick<Lesson, "hideBrand">;
  index: number;
  total: number;
  studio: StudioController;
  /** Which block types this editor offers; defaults to all of them. */
  blockTypes?: BlockType[];
  /** Draw the slide as the room will see it, above the fields that build it. */
  preview?: boolean;
  /**
   * Base material a group may add to but not change.
   *
   * The slide can't be deleted, moved, duplicated or renamed, and its existing
   * blocks are read-only — but the `+` still works, and anything added through it
   * is fully editable. That asymmetry is the whole point of the Advanced Context
   * Studio: the shared lesson stays the shared lesson.
   */
  locked?: boolean;
  /** Whether this document can carry the teacher's half: per-slide notes, blocks
   *  marked teacher-only, and the class-planning fields (duration, goal). All of
   *  it is stripped on write to a student document, so a student-facing editor
   *  shouldn't offer it in the first place. */
  teacherContent?: boolean;
}) {
  const { key, meta, blocks } = slide;
  const setMeta = (patch: Partial<Omit<LessonSlide, "blocks">>) =>
    studio.updateSlideMeta(key, patch);

  return (
    <section
      id={`slide-${key}`}
      className="scroll-mt-24 rounded-xl border bg-card shadow-sm"
    >
      {/* Slide header */}
      <header className="flex items-start gap-3 border-b px-5 py-4">
        {/* No grip: nothing here drags, and a handle that doesn't is a promise
            the card can't keep. Reordering is in the slide menu. */}
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <input
            value={meta.stage}
            readOnly={locked}
            onChange={(e) => setMeta({ stage: e.target.value })}
            placeholder="Stage name (e.g. Warm-up)"
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-1.5">
              <span className="text-xs">id</span>
              <input
                value={meta.id}
                readOnly={locked}
                onChange={(e) => setMeta({ id: e.target.value })}
                placeholder="slide-id"
                className="w-28 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
              />
            </label>
            {locked && (
              <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Base material
              </span>
            )}
            {meta.advancedContext && (
              <button
                type="button"
                onClick={() =>
                  setMeta({ advancedTheme: nextTheme(meta.advancedTheme) })
                }
                title={
                  meta.advancedTheme === "plain"
                    ? "No mark — this slide looks like any other. Click to mark it as Advanced Context"
                    : "Advanced Context mark in the slide's top-left corner — click to remove it"
                }
                className={cn(
                  "rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  meta.advancedTheme === "plain"
                    ? "bg-muted text-muted-foreground hover:bg-muted/70"
                    : "bg-primary/15 text-primary hover:bg-primary/25",
                )}
              >
                {meta.advancedTheme === "plain"
                  ? "Normal slide"
                  : "Advanced · marked"}
              </button>
            )}
            {teacherContent && (
              <>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-xs">⏱</span>
                  <input
                    value={meta.duration}
                    readOnly={locked}
                    onChange={(e) => setMeta({ duration: e.target.value })}
                    placeholder="10 min"
                    className="w-16 bg-transparent outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
                  />
                </label>
                <input
                  value={meta.goal}
                  readOnly={locked}
                  onChange={(e) => setMeta({ goal: e.target.value })}
                  placeholder="Goal of this slide…"
                  className="min-w-40 flex-1 bg-transparent italic outline-none placeholder:not-italic placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
                />
              </>
            )}
          </div>
        </div>

        {/* Slide actions: layout behind one button, the rest behind a menu.
            On a locked slide neither survives — everything in them would change
            the shared lesson rather than this group's copy of it; blocks are
            added from the bar under the block list instead. */}
        {!locked && (
          <div className="flex shrink-0 items-center gap-0.5">
            <SlideLayoutPopover meta={meta} onChange={setMeta} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconAction label="Slide actions">
                  <MoreHorizontalIcon />
                </IconAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={index === 0}
                  onSelect={() => studio.moveSlide(key, -1)}
                >
                  <ChevronUpIcon />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === total - 1}
                  onSelect={() => studio.moveSlide(key, 1)}
                >
                  <ChevronDownIcon />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => studio.duplicateSlide(key)}>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => studio.removeSlide(key)}
                >
                  <Trash2Icon />
                  Delete slide
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {/* The slide itself, above the fields that build it — one picture of the
          whole thing rather than one per block, because what an author is
          checking is how the blocks land together on the stage. */}
      {preview && (
        <div className="px-5 pt-4">
          <SlidePreview slide={slide} lesson={lesson} />
        </div>
      )}

      {/* Blocks, then the one place a block is added from. The bar is where
          the next block will land, which is the thing a "+" in the corner
          never managed to say. */}
      <div className="space-y-1 px-3 py-3">
        {blocks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No blocks yet
          </p>
        ) : (
          blocks.map((block, i) => (
            <BlockEditor
              key={block.key}
              block={block.data}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              teacherContent={teacherContent}
              // A locked slide's base blocks are read-only; the ones this group
              // added to it are theirs, and stay editable.
              readOnly={locked && block.data.advancedContext !== true}
              labelAdvanced={!meta.advancedContext}
              onChange={(data: LessonBlock) =>
                studio.updateBlock(key, block.key, data)
              }
              onMove={(dir) => studio.moveBlock(key, block.key, dir)}
              onDuplicate={() => studio.duplicateBlock(key, block.key)}
              onDelete={() => studio.removeBlock(key, block.key)}
            />
          ))
        )}
        <AddBlockMenu
          onAdd={(type) => studio.addBlock(key, type)}
          blockTypes={blockTypes}
        />
      </div>

      {teacherContent && (
        <div className="px-5 pb-5">
          <TeacherNotes
            notes={meta.teacherNotes ?? []}
            onChange={(notes) => setMeta({ teacherNotes: notes })}
          />
        </div>
      )}
    </section>
  );
}
