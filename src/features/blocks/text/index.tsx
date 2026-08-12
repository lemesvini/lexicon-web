import { TypeIcon } from "lucide-react";
import type { TextBlock } from "@/lib/lessons";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

function View({ block }: { block: TextBlock }) {
  return (
    <section className="space-y-2">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <p className="whitespace-pre-line text-xl leading-relaxed">
        {renderInline(block.body)}
      </p>
      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: TextBlock;
  onChange: (b: TextBlock) => void;
}) {
  return (
    <div className="space-y-1.5">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />
      <AutoTextarea
        value={block.body}
        onValueChange={(body) => onChange({ ...block, body })}
        placeholder="Write the paragraph… **bold**, *italic* supported"
        className="text-lg leading-relaxed"
      />
      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const textBlock: BlockDefinition<TextBlock> = {
  meta: {
    type: "text",
    label: "Text",
    hint: "Paragraph with a label",
    icon: TypeIcon,
  },
  create: () => ({ type: "text", label: "", body: "" }),
  View,
  Editor,
};
