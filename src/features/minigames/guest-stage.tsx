import { INK, JADE } from "@/features/blocks/brand";
import { cn } from "@/lib/utils";
import { AddTile } from "./game-ui";

// The stage the party games share (Who Am I, Two Truths One Lie): a row of
// guests, each a plate above the head, a figure with a nametag on the chest, and
// a frosted sheet over the legs, with the add tile beside them. Each game brings
// its own plate and its own sheet contents; the furniture is drawn here so the
// games stay one family.

/**
 * The guests, dead centre, and the add tile beside them.
 *
 * Three columns on a wide stage: the guests in the middle one, the add tile in
 * the right one, and an empty left one the same width — so however many guests
 * there are, they never get pushed sideways by the tile. On a narrow stage the
 * tile simply goes under them.
 */
export function GuestStage({
  count,
  max,
  onAdd,
  children,
}: {
  count: number;
  max: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <main
      aria-label="Players"
      className="flex flex-1 flex-col items-center justify-center gap-[clamp(18px,3cqw,44px)] pt-2 @4xl:grid @4xl:grid-cols-[minmax(120px,1fr)_minmax(0,max-content)_minmax(120px,1fr)] @4xl:content-center"
    >
      <div className="flex flex-wrap items-center justify-center gap-[clamp(18px,3cqw,44px)] @4xl:col-start-2">
        {children}
      </div>

      {count < max && (
        <AddTile
          count={count}
          max={max}
          onClick={onAdd}
          className="aspect-square w-[clamp(84px,9cqw,120px)] max-w-full self-center rounded-[22px] @4xl:justify-self-start"
        />
      )}
    </main>
  );
}

/** One guest's column: plate, figure and sheet, actions. */
export function GuestColumn({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "flex w-[clamp(200px,19cqw,270px)] flex-col items-center gap-3 animate-in fade-in-40 slide-in-from-bottom-2 duration-350 motion-reduce:animate-none max-[520px]:w-full max-[520px]:max-w-[300px]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** The box above a guest's head. Each game colours it by its own state. */
export const PLATE =
  "flex min-h-[58px] w-full items-center justify-center rounded-[10px] px-3 py-2 text-center text-[13px] font-semibold";

/** The frosted sheet laid over the figure's legs. */
export const GUEST_SHEET =
  "relative z-[1] flex w-full flex-col gap-2 rounded-[18px] border border-[rgba(20,53,42,0.14)] bg-[rgba(252,248,245,0.72)] backdrop-blur-[10px] backdrop-saturate-[1.2] dark:border-[rgba(217,242,231,0.14)] dark:bg-[rgba(20,27,24,0.74)]";

/** The small uppercase heading at the top of a sheet. */
export const SHEET_HEADING =
  "m-0 flex justify-between text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase";

/**
 * The figure, its "Hello, I'm" nametag, and whatever sheet the game lays over
 * its legs (`children`).
 *
 * The nametag's field is uncontrolled and committed on blur, so a name is one
 * Undo step rather than one per letter; it is keyed by the value so an Undo that
 * changes the name redraws the field.
 */
export function GuestFigure({
  player,
  index,
  onPlayer,
  children,
}: {
  player: string;
  index: number;
  onPlayer: (player: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full flex-col items-center">
      <svg
        viewBox="0 0 120 230"
        aria-hidden
        className="-mb-[34%] block w-[62%] max-w-[170px] fill-[#14352A] dark:fill-[#2A6A54]"
      >
        <circle cx="60" cy="34" r="30" />
        <path d="M38 72c6 4 14 6 22 6s16-2 22-6c13 2 22 13 24 26l9 64c.4 3-1 5-3 6l-17 10-7 46c-1 6-6 10-12 10H44c-6 0-11-4-12-10l-7-46-17-10c-2-1-3.4-3-3-6l9-64c2-13 11-24 24-26z" />
      </svg>

      <label className="absolute top-[44%] left-1/2 z-[2] w-[46%] max-w-32 -translate-x-1/2 -translate-y-1/2 -rotate-3 overflow-hidden rounded-[7px] bg-[#FCF8F5] text-center shadow-[0_3px_10px_hsl(0_0%_0%/0.2)] dark:bg-[#F1ECE4]">
        <span
          className="block py-0.5 text-[9px] font-bold tracking-[0.14em] uppercase"
          style={{ background: JADE, color: INK }}
        >
          Hello, I'm
        </span>
        <input
          key={player}
          type="text"
          defaultValue={player}
          maxLength={18}
          placeholder="Name"
          aria-label={`Player ${index + 1} name`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== player) onPlayer(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full text-ellipsis border-0 bg-transparent px-1.5 pt-1 pb-[5px] text-center text-[15px] font-bold text-[#14352A] outline-none placeholder:font-semibold placeholder:text-[#7A8C84] focus:bg-[rgba(97,180,149,0.18)]"
        />
      </label>

      {children}
    </div>
  );
}
