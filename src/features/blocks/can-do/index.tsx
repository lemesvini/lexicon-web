import { AwardIcon } from "lucide-react";
import type { CanDoBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { FOREST, SAND, withAlpha } from "../brand";
import { TITLE_COLORS } from "../title";

// The closing slide: a sand card laid on the slide's ground, holding "Now you
// can", the lesson's minor can-do and a sign-off on one side and the "now you
// CAN" badge on the other. The badge is on the card, not in a panel of its own.
// Full-bleed like the title cover, and for the same reason sized with container
// queries rather than against a fixed 16:9 stage.
//
// `color` is the ground around the card, from the title cover's own palette
// (TITLE_COLORS). The card is always sand with forest type: it is the thing
// being read, and it should read the same whatever it sits on.

type CanDoColor = NonNullable<CanDoBlock["color"]>;

/** Rough average advance width of the serif face, as a fraction of the font
 *  size. */
const CHAR_WIDTH = 0.5;
const LINE_HEIGHT = 1.35;
/** The text column's width and the height the statement may fill, in cqw. */
const COLUMN = 47;
const BUDGET = 10;

/**
 * Sizes the statement to fill its column. A can-do is a sentence, not a
 * headline, and its line breaks are left to the browser — so the fit is by
 * area: at size `s` it runs to `n·w·s / COLUMN` lines of `h·s` each, and
 * solving that against the height budget gives `s`. The `cqh` twin keeps a
 * short, wide screen from overflowing, and the ceiling stops a three-word can-do
 * from turning into a wall.
 */
function statementSize(text: string): string {
  const n = Math.max(text.length, 1);
  const s = Math.sqrt((COLUMN * BUDGET) / (n * CHAR_WIDTH * LINE_HEIGHT));
  const cqw = Math.min(s, 2.5);
  return `min(${cqw.toFixed(2)}cqw, ${(cqw * 1.78).toFixed(2)}cqh)`;
}

function View({ block }: { block: CanDoBlock }) {
  // A block saved while "sand" was briefly a ground colour would otherwise
  // take the page down; any unknown value falls back to the default.
  const { background } = (TITLE_COLORS[block.color ?? "forest"] ??
    TITLE_COLORS.forest) as (typeof TITLE_COLORS)["forest"];

  return (
    <div
      className="relative flex aspect-video h-full w-full items-center justify-center overflow-hidden"
      style={{ containerType: "size", background }}
    >
      <div
        className="flex h-[78cqh] w-[84cqw] items-stretch gap-[3cqw] overflow-hidden rounded-[1.2cqw] py-[9cqh] pr-[3cqw] pl-[5cqw]"
        style={{
          background: SAND,
          color: FOREST,
          boxShadow: `0 1cqh 4cqh ${withAlpha(FOREST, 0.25)}`,
        }}
      >
        <div className="flex min-w-0 flex-[0_0_47cqw] flex-col justify-between">
          <div>
            {block.eyebrow && (
              <p
                className="font-mono uppercase opacity-75"
                style={{
                  fontSize: "min(1.15cqw, 2cqh)",
                  letterSpacing: "0.12em",
                }}
              >
                {block.eyebrow}
              </p>
            )}
            <h2
              className="mt-[2.5cqh] font-display leading-none"
              style={{ fontSize: "min(4cqw, 7.1cqh)" }}
            >
              Now you can
            </h2>
            <p
              className="mt-[4cqh] whitespace-pre-line font-serif"
              style={{
                fontSize: statementSize(block.text),
                lineHeight: LINE_HEIGHT,
              }}
            >
              {block.text}
            </p>
          </div>

          <footer className="flex items-baseline justify-between border-t border-current/15 pt-[4cqh]">
            <p
              className="font-display leading-none"
              style={{ fontSize: "min(2.3cqw, 4.1cqh)" }}
            >
              Thank you
            </p>
            <p
              className="font-sans opacity-70"
              style={{ fontSize: "min(1.45cqw, 2.6cqh)" }}
            >
              See you next class
            </p>
          </footer>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <img
            src="/cando.png"
            alt="Lexicon — now you can"
            className="max-h-[60cqh] max-w-full object-contain drop-shadow-[0_1cqh_1.5cqh_rgb(20_53_42/20%)]"
          />
        </div>
      </div>
    </div>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: CanDoBlock;
  onChange: (b: CanDoBlock) => void;
}) {
  const color = block.color ?? "forest";

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <input
          value={block.eyebrow ?? ""}
          onChange={(e) => onChange({ ...block, eyebrow: e.target.value })}
          placeholder="Eyebrow (e.g. Lesson complete · My Daily Routine)"
          className="w-full bg-transparent font-mono text-xs uppercase tracking-wider text-muted-foreground outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
        />
        <p className="font-display text-lg">Now you can</p>
        <AutoTextarea
          value={block.text}
          onValueChange={(text) => onChange({ ...block, text })}
          placeholder="The lesson's minor can-do…"
          className="font-serif text-lg leading-snug"
        />
      </div>

      <div className="flex items-center gap-1.5 border-t pt-2">
        {(Object.keys(TITLE_COLORS) as CanDoColor[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, color: value })}
            aria-label={TITLE_COLORS[value].label}
            title={TITLE_COLORS[value].label}
            style={{ background: TITLE_COLORS[value].background }}
            className={cn(
              "size-5 rounded-full border border-border transition-transform hover:scale-110",
              color === value &&
                "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const canDoBlock: BlockDefinition<CanDoBlock> = {
  meta: {
    type: "can-do",
    label: "Now You Can",
    hint: "The minor can-do next to the badge",
    icon: AwardIcon,
  },
  create: () => ({ type: "can-do", eyebrow: "", text: "", color: "forest" }),
  View,
  Editor,
};
