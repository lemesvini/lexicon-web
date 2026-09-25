import { LayoutListIcon, ListIcon } from "lucide-react";
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
import { Segmented } from "../editor-ui/segmented";

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
        <span className="mt-px flex size-7 items-center justify-center rounded-full border-[1.5px] border-current/60 text-sm font-medium tabular-nums">
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

/**
 * One item as a card: a tinted, bordered box with the marker in the corner.
 * The first line is the heading when there is more than one — "Round one: what
 * you see" over "Pick three cards…" — so an author writes a step as a title and
 * a body without a second field for it.
 */
function CardItem({
  item,
  style,
  index,
}: {
  item: string;
  style: ListBlock["style"];
  index: number;
}) {
  const [first, ...rest] = item.split("\n");
  const body = rest.join("\n").trim();
  return (
    <li className="flex gap-4 rounded-xl border border-primary/25 bg-primary/[0.06] px-5 py-4">
      <ListMarker style={style} index={index} />
      <div className="min-w-0 space-y-1">
        {body ? (
          <>
            <p className="text-xl font-semibold leading-snug">
              {renderInline(first)}
            </p>
            <p className="whitespace-pre-line text-lg leading-relaxed text-foreground/85">
              {renderInline(body)}
            </p>
          </>
        ) : (
          <p className="whitespace-pre-line text-lg leading-relaxed">
            {renderInline(item)}
          </p>
        )}
      </div>
    </li>
  );
}

function View({ block }: { block: ListBlock }) {
  return (
    <section className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      {block.cards ? (
        <ul className="space-y-3">
          {block.items.map((item, i) => (
            <CardItem key={i} item={item} style={block.style} index={i} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-lg leading-relaxed">
              <ListMarker style={block.style} index={i} />
              <span className="whitespace-pre-line">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )}
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
        <div className="flex shrink-0 items-center gap-1.5">
          <Segmented
            value={block.style}
            onChange={(style) => onChange({ ...block, style })}
            options={STYLES}
            label="List style"
          />
          <button
            type="button"
            aria-pressed={!!block.cards}
            title={
              block.cards
                ? "Cards — each item in its own box. Click for plain lines"
                : "Plain lines — click to draw each item as a card"
            }
            onClick={() =>
              onChange({ ...block, cards: block.cards ? undefined : true })
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              block.cards
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <LayoutListIcon className="size-3.5" />
            Cards
          </button>
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
