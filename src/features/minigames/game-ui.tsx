import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The furniture both games share — the paper they sit on, the header, the two
// kinds of button. They were designed as one family (same tokens, same type),
// so they are drawn from one place to stay that way.

/** The heading colour: forest on sand, mist on the dark ground. */
export const GAME_HEADING = "text-primary dark:text-[oklch(0.94_0.03_167)]";

/**
 * The box a game is drawn in: the app's sand, a whisper of grain, and the
 * container its layout queries against.
 *
 * A game sizes itself to this box and never to the window, because it is shown
 * in three very different boxes — the Minigames page, a full-bleed slide on the
 * projector, and that same slide scaled down to a studio thumbnail. Container
 * queries (`@4xl:` and friends) and `cqw` units are what make one layout hold in
 * all three. It is also the anchor for the game's toasts and dialogs.
 */
export function GamePaper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container relative isolate h-full w-full overflow-auto bg-background font-montserrat text-[15px] leading-normal text-foreground antialiased",
        className,
      )}
    >
      <div
        aria-hidden
        className="grain pointer-events-none absolute inset-0 -z-10 opacity-5"
      />
      {children}
    </div>
  );
}

/** The props every game takes from whoever mounts it. */
export type GameProps = {
  /** Which surface is playing, outside a presentation — each keeps its own
   *  round. Inside one, the session's scope is used instead. See `storageKey`. */
  scope?: string;
  /** Drawn at the head of the game's header, before the title: the app's
   *  navigation when the game is a page of its own (see `GameNav`). */
  lead?: React.ReactNode;
};

/**
 * The height of the title block below: a 34px title, 6px, and a 20px line of
 * subtitle. Anything in `lead` that should line up with the block top and
 * bottom — the square mark in `GameNav` — takes this. Change one, change both.
 */
export const GAME_TITLE_HEIGHT = "h-[60px]";

/**
 * The game's one bar: whatever `lead` brings, the title and its one-line rule,
 * and every control the game has, on the right.
 */
export function GameHeader({
  title,
  subtitle,
  lead,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {lead}
        <div className="min-w-0">
        <h1
          className={cn(
            "m-0 font-display text-[34px] leading-none font-normal",
            GAME_HEADING,
          )}
        >
          {title}
        </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </header>
  );
}

/** The games' own button: smaller and squarer than the app's, so a row of them
 *  fits beside a title on a projector without wrapping. */
export function GameButton({
  primary = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-md border px-[13px] py-2 text-[13px] font-semibold transition-[background-color,filter] disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:brightness-110"
          : "border-input bg-card hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/** An underlined text action — "Remove", "Edit names". */
export function GameLinkButton({
  warn = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { warn?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer border-0 bg-transparent px-0.5 py-1 text-xs font-semibold underline underline-offset-3",
        warn
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** A dialog laid over the game, not over the page — see `GamePaper`. */
export function GameDialog({
  open,
  labelledBy,
  children,
}: {
  open: boolean;
  labelledBy: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-[440px] rounded-[14px] border bg-card px-7 py-[26px]"
      >
        {children}
      </div>
    </div>
  );
}

/** The display-face heading inside a `GameDialog`. */
export function GameDialogTitle({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className={cn(
        "m-0 mb-1.5 font-display text-[34px] leading-[1.05] font-normal",
        GAME_HEADING,
      )}
    >
      {children}
    </h3>
  );
}

/**
 * The dashed "one more player" tile both games end their players with: a plus
 * and how many seats are taken. Its size and corner are the caller's — a square
 * on the Who Am I stage, a row the height of a player card in Crossings — but
 * the border is this one, so the two read as the same control.
 */
export function AddTile({
  count,
  max,
  onClick,
  className,
  glyphClassName = "w-[42%]",
}: {
  count: number;
  max: number;
  onClick: () => void;
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Add a player"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed border-input bg-transparent text-xs font-semibold text-muted-foreground hover:border-ring hover:bg-card hover:text-foreground",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <svg viewBox="0 0 40 40" aria-hidden className={cn("h-auto", glyphClassName)}>
        <rect x="17" y="4" width="6" height="32" rx="2" fill="currentColor" />
        <rect x="4" y="17" width="32" height="6" rx="2" fill="currentColor" />
      </svg>
      <span>
        {count} of {max}
      </span>
    </button>
  );
}

/** Input styled like the games' clue and name fields. */
export const GAME_INPUT =
  "w-full rounded-md border border-input bg-card px-2.5 py-[7px] text-sm font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * A select in a game's header — Crossings' unit, Word Cards' module and unit.
 *
 * The browser's own arrow is switched off (`appearance-none`) and drawn here
 * instead: the native one sits flush against the right edge whatever padding
 * the box is given, and ours gets the same breathing room as the text.
 */
export function GameSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "w-full cursor-pointer appearance-none rounded-md border border-input bg-card py-[7px] pr-9 pl-3 text-sm font-semibold text-foreground",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

/** The games' red for a wrong answer or a word not to say. The app's
 *  destructive token is a shade too dark to read on a projector. */
export const GAME_DANGER_TEXT = "text-[#9B2C2C] dark:text-[#E26D5F]";

/** A captioned control in a game's header. A `div`, not a `label`: most of
 *  these hold a row of buttons, and a label would click the first one for you.
 *  A select inside one names itself with `aria-label`. */
export function GameField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[3px] text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </div>
  );
}
