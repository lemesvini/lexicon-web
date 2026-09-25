import { MessageSquareIcon } from "lucide-react";
import type { CalloutBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { AutoTextarea } from "../editor-ui/auto-textarea";

/** Callout background tokens used across the lesson JSON, with editor swatches. */
export const CALLOUT_COLORS: { value: string; label: string; swatch: string }[] =
  [
    { value: "blue_bg", label: "Blue", swatch: "bg-blue-100 border-blue-300" },
    { value: "green_bg", label: "Green", swatch: "bg-green-100 border-green-300" },
    { value: "yellow_bg", label: "Yellow", swatch: "bg-amber-100 border-amber-300" },
    { value: "gray_bg", label: "Gray", swatch: "bg-neutral-100 border-neutral-300" },
    { value: "red_bg", label: "Red", swatch: "bg-red-100 border-red-300" },
  ];

/** Tailwind classes for rendering a callout by its color token. */
export function calloutClasses(color: string | undefined): string {
  switch (color) {
    // The brand green rather than Tailwind's: on the projector this is the
    // house colour, and it should read as the same green the list cards use.
    case "green_bg":
      return "bg-primary/[0.08] border-primary/30";
    case "yellow_bg":
      return "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900";
    case "gray_bg":
      return "bg-neutral-50 border-neutral-200 dark:bg-neutral-900/60 dark:border-neutral-800";
    case "red_bg":
      return "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900";
    case "blue_bg":
    default:
      return "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900";
  }
}

function View({ block }: { block: CalloutBlock }) {
  return (
    <div
      className={cn("rounded-xl border px-6 py-5", calloutClasses(block.color))}
    >
      <div className="flex items-start gap-4">
        {block.icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-current/50 text-xl leading-none">
            {block.icon}
          </span>
        )}
        <div className="min-w-0 space-y-1.5">
          <p className="text-xl font-semibold leading-snug">{block.title}</p>
          <p className="whitespace-pre-line text-lg leading-relaxed text-foreground/85">
            {renderInline(block.body)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: CalloutBlock;
  onChange: (b: CalloutBlock) => void;
}) {
  return (
    <div className={cn("rounded-lg border p-4", calloutClasses(block.color))}>
      <div className="flex items-start gap-3">
        <input
          value={block.icon ?? ""}
          onChange={(e) => onChange({ ...block, icon: e.target.value })}
          aria-label="Icon"
          maxLength={2}
          className="w-9 shrink-0 rounded-md bg-background/60 text-center text-xl outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Callout title"
            className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
          />
          <AutoTextarea
            value={block.body}
            onValueChange={(body) => onChange({ ...block, body })}
            placeholder="Callout body…"
            className="text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-current/10 pt-3">
        {CALLOUT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange({ ...block, color: c.value })}
            aria-label={c.label}
            title={c.label}
            className={cn(
              "size-5 rounded-full border transition-transform hover:scale-110",
              c.swatch,
              block.color === c.value &&
                "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const calloutBlock: BlockDefinition<CalloutBlock> = {
  meta: {
    type: "callout",
    label: "Callout",
    hint: "Boxed note with an icon",
    icon: MessageSquareIcon,
  },
  create: () => ({
    type: "callout",
    icon: "💡",
    color: "blue_bg",
    title: "",
    body: "",
  }),
  View,
  Editor,
};
