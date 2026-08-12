import { ListIcon } from "lucide-react";
import type { ListBlock } from "@/lib/lessons";
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

const STYLES: { value: ListBlock["style"]; label: string }[] = [
  { value: "bullet", label: "Bullet" },
  { value: "numbered", label: "Numbered" },
  { value: "checklist", label: "Checklist" },
];

/** Editor-side plain-text marker (compact, single-column). */
function marker(style: ListBlock["style"], index: number): string {
  if (style === "numbered") return `${index + 1}.`;
  if (style === "checklist") return "☐";
  return "•";
}

/** Presentation marker — rendered on a uniform 1.5rem indent so bullet,
 *  numbered, and checklist lists all align their text to the same edge. */
function ListMarker({
  style,
  index,
}: {
  style: ListBlock["style"];
  index: number;
}) {
  return (
    <span className="flex w-6 shrink-0 select-none justify-center">
      {style === "numbered" ? (
        <span className="mt-px flex size-6 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
          {index + 1}
        </span>
      ) : style === "checklist" ? (
        <span
          aria-hidden
          className="mt-[0.2em] size-5 rounded-md border-2 border-muted-foreground/35"
        />
      ) : (
        <span
          aria-hidden
          className="mt-[0.6em] size-1.5 rounded-full bg-primary/70"
        />
      )}
    </span>
  );
}

function View({ block }: { block: ListBlock }) {
  return (
    <section className="space-y-2">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <ul className="space-y-2.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-3 text-lg leading-relaxed">
            <ListMarker style={block.style} index={i} />
            <span className="whitespace-pre-line">{renderInline(item)}</span>
          </li>
        ))}
      </ul>
      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: ListBlock;
  onChange: (b: ListBlock) => void;
}) {
  const setItem = (i: number, value: string) => {
    const items = block.items.slice();
    items[i] = value;
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, ""] });
  const removeItem = (i: number) =>
    onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <BlockLabelInput
          value={block.label ?? ""}
          onChange={(label) => onChange({ ...block, label })}
        />
        <div className="flex shrink-0 gap-1 rounded-md bg-muted p-0.5">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ ...block, style: s.value })}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors",
                block.style === s.value &&
                  "bg-background text-foreground shadow-sm",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-1">
        {block.items.map((item, i) => (
          <li key={i} className="group/row flex items-start gap-2">
            <span className="mt-1 w-5 shrink-0 select-none text-right text-sm text-muted-foreground tabular-nums">
              {marker(block.style, i)}
            </span>
            <AutoTextarea
              value={item}
              onValueChange={(v) => setItem(i, v)}
              placeholder="List item…"
              className="text-base leading-relaxed"
            />
            <span className="opacity-0 transition-opacity group-hover/row:opacity-100">
              <DeleteRowButton onClick={() => removeItem(i)} label="Remove item" />
            </span>
          </li>
        ))}
      </ul>

      <AddRowButton onClick={addItem} label="Add item" />

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const listBlock: BlockDefinition<ListBlock> = {
  meta: {
    type: "list",
    label: "List",
    hint: "Bulleted / numbered / checklist",
    icon: ListIcon,
  },
  create: () => ({ type: "list", label: "", style: "bullet", items: [""] }),
  View,
  Editor,
};
