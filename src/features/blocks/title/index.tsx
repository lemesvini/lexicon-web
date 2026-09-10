import { HeadingIcon } from "lucide-react";
import type { TitleBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { FOREST, INK, JADE, MIST, withAlpha } from "../brand";
import { AutoTextarea } from "../editor-ui/auto-textarea";

// The cover slide, drawn instead of uploaded. See `TitleBlock` in @/lib/lessons
// for why: an image is cropped to whatever screen it lands on, type is not.
//
// The greens come from ../brand (docs/presenter.md → Brand) rather than from the
// theme tokens: a projected cover must look the same in either app theme.

type TitleColor = NonNullable<TitleBlock["color"]>;

export const TITLE_COLORS: Record<
  TitleColor,
  { label: string; background: string; foreground: string }
> = {
  jade: { label: "Jade", background: JADE, foreground: MIST },
  forest: { label: "Forest", background: FOREST, foreground: MIST },
  mist: { label: "Mist", background: MIST, foreground: FOREST },
  // Laid over a wallpaper image. Not fully transparent: a photo underneath can
  // be any brightness, so a soft scrim (darkest where the headline sits) is what
  // keeps the type readable without hiding the picture.
  clear: {
    label: "Over image",
    background: `linear-gradient(to top, ${withAlpha(INK, 0.55)}, ${withAlpha(INK, 0.05)})`,
    foreground: MIST,
  },
};

/** Rough average advance width of Caprasimo, as a fraction of the font size —
 *  enough to size the headline to its longest line without measuring the DOM. */
const CHAR_WIDTH = 0.62;
const LINE_HEIGHT = 0.95;

/**
 * The headline's font size, as a length that fits the slide in BOTH axes: the
 * `cqw` term caps it by width (the longest line), the `cqh` term by height (how
 * many lines), and `min()` takes whichever runs out first — plus a ceiling so a
 * two-word title doesn't turn into a wall.
 *
 * This is the whole trick behind the block: nothing is sized against a 16:9
 * stage, so a taller or wider screen re-lays the cover instead of cropping it.
 */
function headlineSize(lines: string[]): string {
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const byWidth = 86 / (CHAR_WIDTH * longest);
  const byHeight = 52 / (lines.length * LINE_HEIGHT);
  return `min(${byWidth.toFixed(1)}cqw, ${byHeight.toFixed(1)}cqh, 16cqw)`;
}

/**
 * The lockup, not just the word: "lexicon" in the display face with ENGLISH
 * ruled underneath it, the same mark as the printed one.
 *
 * The second line is Montserrat rather than the display face — it is a rule
 * more than a word, and Caprasimo at that size reads as a smudge. Its size and
 * tracking are in `em`, so the whole lockup scales off the one `fontSize` here
 * and stays glued together at any slide size. Letter-spacing lands after the
 * last letter too, which shoves the line visibly left of centre; the negative
 * right margin takes that trailing space back off.
 */
function Wordmark() {
  return (
    <span
      className="ml-auto flex flex-col items-center leading-none"
      style={{ fontSize: "min(4.2cqw, 7.5cqh)" }}
    >
      <span className="font-display lowercase tracking-tight">lexicon</span>
      <span
        className="font-montserrat"
        style={{
          fontSize: "0.3em",
          letterSpacing: "0.42em",
          marginRight: "-0.42em",
          marginTop: "0.24em",
        }}
      >
        ENGLISH
      </span>
    </span>
  );
}

function View({ block }: { block: TitleBlock }) {
  const { background, foreground } = TITLE_COLORS[block.color ?? "jade"];
  const lines = block.title.split("\n");

  return (
    // Container queries, not viewport units: the same markup is a full-bleed
    // slide in the presenter, a 16:9 panel in a student's page and a thumbnail
    // in the studio, and all three should be the same picture at different
    // sizes. `aspect-video` only applies where the height is left to us — given
    // a full-size parent (SlideView lifts this block into one), `h-full` wins.
    <div
      className="relative aspect-video h-full w-full overflow-hidden"
      style={{ containerType: "size", background, color: foreground }}
    >
      <div className="flex h-full w-full flex-col justify-between px-[7cqw] py-[8cqh]">
        {/* Baseline, not top: the eyebrow and the wordmark are different faces
            at different sizes, so aligning their boxes leaves the two texts
            sitting on visibly different lines. */}
        <header className="flex items-baseline justify-between gap-[6cqw] leading-none">
          {/* Sans, not the display face: the wordmark and the headline are the
              only two things on a cover that should read as display type, and a
              third one competes with both. */}
          {block.eyebrow && (
            <p
              className="font-sans font-semibold"
              style={{ fontSize: "min(3cqw, 5.4cqh)" }}
            >
              {block.eyebrow}
            </p>
          )}
          {!block.hideWordmark && <Wordmark />}
        </header>

        <div className="space-y-[2.5cqh]">
          <h2
            className="whitespace-pre-line font-display"
            style={{ fontSize: headlineSize(lines), lineHeight: LINE_HEIGHT }}
          >
            {block.title}
          </h2>
          {block.subtitle && (
            <p
              className="max-w-[70cqw] font-sans leading-snug opacity-80"
              style={{ fontSize: "min(3cqw, 5.4cqh)" }}
            >
              {block.subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: TitleBlock;
  onChange: (b: TitleBlock) => void;
}) {
  const color = block.color ?? "jade";

  // No preview here: the studio draws one above every block's fields now (see
  // `BlockPreview`), and this block's was the model for it. A second copy would
  // just be the same cover twice.
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <input
          value={block.eyebrow ?? ""}
          onChange={(e) => onChange({ ...block, eyebrow: e.target.value })}
          placeholder="Eyebrow (e.g. Lesson One)"
          className="w-full bg-transparent text-sm font-semibold text-muted-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
        />
        <AutoTextarea
          value={block.title}
          onValueChange={(title) => onChange({ ...block, title })}
          placeholder="Title — press Enter to choose where it breaks"
          className="font-display text-2xl leading-tight"
        />
        <input
          value={block.subtitle ?? ""}
          onChange={(e) => onChange({ ...block, subtitle: e.target.value })}
          placeholder="Subtitle (optional)"
          className="w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="flex items-center gap-1.5 border-t pt-2">
        {(Object.keys(TITLE_COLORS) as TitleColor[]).map((value) => (
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
        <button
          type="button"
          onClick={() =>
            onChange({
              ...block,
              hideWordmark: block.hideWordmark ? undefined : true,
            })
          }
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
            block.hideWordmark
              ? "text-muted-foreground hover:bg-accent"
              : "bg-primary/15 text-primary",
          )}
        >
          Wordmark
        </button>
      </div>
    </div>
  );
}

export const titleBlock: BlockDefinition<TitleBlock> = {
  meta: {
    type: "title",
    label: "Title",
    hint: "Full-screen cover with a huge headline",
    icon: HeadingIcon,
  },
  create: () => ({ type: "title", eyebrow: "", title: "", color: "jade" }),
  View,
  Editor,
};
