import { PenLineIcon } from "lucide-react";
import type { LongAnswerBlock } from "@/lib/lessons";
import type { BlockAnswerProps, BlockDefinition, BlockViewProps } from "../types";
import { newBlockId } from "../block-id";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

function Question({ block }: { block: LongAnswerBlock }) {
  return (
    <div className="space-y-1">
      <p className="text-xl leading-relaxed">{renderInline(block.question)}</p>
      {block.hint && (
        <p className="text-sm text-muted-foreground">{block.hint}</p>
      )}
    </div>
  );
}

function View({ block }: BlockViewProps<LongAnswerBlock>) {
  return (
    <section className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <Question block={block} />
      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Written answer
      </div>
      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

/**
 * There is no key here and never will be — a written answer is marked by a
 * person. `mark_answers` in 0005 skips any block without an `answer`, which is
 * what leaves this one on the teacher's pile.
 */
function Answer({
  block,
  value,
  onChange,
  disabled,
}: BlockAnswerProps<LongAnswerBlock>) {
  const text = typeof value === "string" ? value : "";

  return (
    <section className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <Question block={block} />

      {disabled ? (
        <div className="whitespace-pre-line rounded-xl border bg-muted/30 px-4 py-3 text-base leading-relaxed">
          {text || (
            <span className="text-muted-foreground">Left blank.</span>
          )}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="Write your answer…"
          className="w-full rounded-xl border bg-background px-4 py-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
        />
      )}

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: LongAnswerBlock;
  onChange: (b: LongAnswerBlock) => void;
}) {
  return (
    <div className="space-y-3">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <AutoTextarea
        value={block.question}
        onValueChange={(question) => onChange({ ...block, question })}
        placeholder="What do you want them to answer?"
        className="rounded-md border bg-background px-3 py-1.5 text-base"
      />

      <input
        value={block.hint ?? ""}
        onChange={(e) => onChange({ ...block, hint: e.target.value })}
        placeholder="Guidance, e.g. “3–5 sentences” (optional)"
        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
      />

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const longAnswerBlock: BlockDefinition<LongAnswerBlock> = {
  meta: {
    type: "long-answer",
    label: "Written answer",
    hint: "A question they answer in their own words",
    icon: PenLineIcon,
  },
  create: () => ({
    type: "long-answer",
    id: newBlockId(),
    question: "",
  }),
  View,
  Editor,
  Answer,
};
