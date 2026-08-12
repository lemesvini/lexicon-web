import { MessagesSquareIcon } from "lucide-react";
import type { DialogBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  NoteInput,
} from "../editor-ui/primitives";

/** Assign each speaker a chat side by first appearance: speaker 1 → left,
 *  speaker 2 → right, then alternating for any further speakers. */
function sideResolver(lines: DialogBlock["lines"]) {
  const order: string[] = [];
  for (const l of lines) if (!order.includes(l.speaker)) order.push(l.speaker);
  return (speaker: string): "left" | "right" =>
    order.indexOf(speaker) % 2 === 0 ? "left" : "right";
}

function View({ block }: { block: DialogBlock }) {
  const sideOf = sideResolver(block.lines);
  return (
    <section className="space-y-2.5">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <div className="flex flex-col gap-2 rounded-2xl border bg-card/40 px-4 py-4">
        {block.lines.map((line, i) => {
          const side = sideOf(line.speaker);
          // Only label a bubble when the speaker changes — consecutive lines
          // from one speaker read as a grouped run, like a chat thread.
          const startsRun = i === 0 || block.lines[i - 1].speaker !== line.speaker;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-1",
                startsRun && i > 0 && "mt-1.5",
                side === "right" ? "items-end" : "items-start",
              )}
            >
              {startsRun && (
                <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {line.speaker}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-lg leading-relaxed shadow-sm",
                  side === "right"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm bg-muted text-foreground",
                )}
              >
                {renderInline(line.text)}
              </div>
            </div>
          );
        })}
      </div>
      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: DialogBlock;
  onChange: (b: DialogBlock) => void;
}) {
  const setLine = (i: number, patch: Partial<DialogBlock["lines"][number]>) =>
    onChange({
      ...block,
      lines: block.lines.map((l, li) => (li === i ? { ...l, ...patch } : l)),
    });
  const addLine = () =>
    onChange({ ...block, lines: [...block.lines, { speaker: "", text: "" }] });
  const removeLine = (i: number) =>
    onChange({ ...block, lines: block.lines.filter((_, li) => li !== i) });

  return (
    <div className="space-y-2">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <div className="space-y-1.5">
        {block.lines.map((line, i) => (
          <div key={i} className="group/row flex items-start gap-2">
            <input
              value={line.speaker}
              onChange={(e) => setLine(i, { speaker: e.target.value })}
              placeholder="Speaker"
              className="mt-0.5 w-24 shrink-0 rounded-md bg-muted px-2 py-1 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/30"
            />
            <AutoTextarea
              value={line.text}
              onValueChange={(v) => setLine(i, { text: v })}
              placeholder="Line…"
              className="pt-1 text-base leading-relaxed"
            />
            <span className="opacity-0 transition-opacity group-hover/row:opacity-100">
              <DeleteRowButton onClick={() => removeLine(i)} label="Remove line" />
            </span>
          </div>
        ))}
      </div>

      <AddRowButton onClick={addLine} label="Add line" />

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const dialogBlock: BlockDefinition<DialogBlock> = {
  meta: {
    type: "dialog",
    label: "Dialog",
    hint: "Speaker / line exchange",
    icon: MessagesSquareIcon,
  },
  create: () => ({ type: "dialog", label: "", lines: [{ speaker: "", text: "" }] }),
  View,
  Editor,
};
