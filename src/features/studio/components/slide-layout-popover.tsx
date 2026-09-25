import {
  Columns2Icon,
  LayoutTemplateIcon,
  Rows2Icon,
} from "lucide-react";

import type { LessonSlide } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import { IconAction, Segmented } from "@/features/blocks";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Meta = Omit<LessonSlide, "blocks">;
type Align = NonNullable<LessonSlide["align"]>;
type Justify = NonNullable<LessonSlide["justify"]>;

const ALIGNS: Align[] = ["top", "middle", "bottom"];
const JUSTIFIES: Justify[] = ["left", "center", "right"];

/**
 * The nine places the content can sit, as a grid the shape of the stage.
 *
 * A picture rather than two dropdowns: "top-left" is a cell you point at, not
 * two words you assemble, and the grid is the stage in miniature so the cell
 * you pick is where the content will be.
 */
function PositionGrid({
  align,
  justify,
  onChange,
}: {
  align: Align;
  justify: Justify;
  onChange: (next: { align: Align; justify: Justify }) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Content position"
      className="grid aspect-video w-full grid-cols-3 grid-rows-3 gap-1 rounded-md border bg-muted/40 p-1"
    >
      {ALIGNS.map((a) =>
        JUSTIFIES.map((j) => {
          const active = a === align && j === justify;
          return (
            <button
              key={`${a}-${j}`}
              type="button"
              role="radio"
              aria-checked={active}
              title={`${a} ${j}`}
              onClick={() => onChange({ align: a, justify: j })}
              className={cn(
                "flex items-center justify-center rounded-sm transition-colors hover:bg-accent",
                active && "bg-primary/15",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  active ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            </button>
          );
        }),
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Everything about how a slide is laid out, behind one button.
 *
 * These used to be four separate toggles in the slide header (stage on/off,
 * row/column) with nowhere to put the next one. Grouping them is what makes
 * room for the position grid and the wordmark switch, and it also puts them
 * where an author looks for them: "layout" is one question, not four.
 */
export function SlideLayoutPopover({
  meta,
  onChange,
}: {
  meta: Meta;
  onChange: (patch: Partial<Meta>) => void;
}) {
  const brand: "default" | "on" | "off" =
    meta.hideBrand === undefined ? "default" : meta.hideBrand ? "off" : "on";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconAction label="Layout — position, direction, stage title, wordmark">
          <LayoutTemplateIcon />
        </IconAction>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Position
          </p>
          <PositionGrid
            align={meta.align ?? "middle"}
            justify={meta.justify ?? "center"}
            onChange={onChange}
          />
        </div>

        <Row label="Blocks">
          <Segmented
            value={meta.layout ?? "column"}
            onChange={(layout) => onChange({ layout })}
            options={[
              { value: "column", label: "Stack", icon: Rows2Icon },
              { value: "row", label: "Side by side", icon: Columns2Icon },
            ]}
            label="Block direction"
          />
        </Row>

        <Row label="Stage title">
          <Segmented
            value={meta.hideStage ? "off" : "on"}
            onChange={(v) => onChange({ hideStage: v === "off" })}
            options={[
              { value: "on", label: "Show" },
              { value: "off", label: "Hide" },
            ]}
            label="Stage title"
          />
        </Row>

        <Row label="Wordmark">
          <Segmented
            value={brand}
            onChange={(v) =>
              onChange({
                hideBrand: v === "default" ? undefined : v === "off",
              })
            }
            options={[
              { value: "default", label: "Deck", title: "Follow the deck's setting" },
              { value: "on", label: "Show" },
              { value: "off", label: "Hide" },
            ]}
            label="Wordmark"
          />
        </Row>
      </PopoverContent>
    </Popover>
  );
}
