import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { SLIDE_MS, WORDMARK } from "@/components/nav-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import type { LinkTo } from "@/lib/nav";
import { isStaff } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** The content columns pages lay themselves out in. Spelled out rather than
 *  interpolated, because Tailwind only ships classes it can see in the source. */
const COLUMN = {
  wide: "max-w-6xl",
  narrow: "max-w-3xl",
} as const;

/** The ring every control in this bar takes when it is tabbed to. */
const FOCUS_RING =
  "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The app's top bar: the menu button, the wordmark, and a way back out of a page
 * that has one.
 *
 * The menu button opens the sidebar (see @/components/nav-sidebar) — as does
 * brushing the left edge of the screen, or ⌘K. It sits next to the wordmark
 * rather than out at the corner so the pair reads as one mark, and so it is
 * where the eye already is.
 *
 * The back arrow lives here rather than in each page's own header so that it is
 * always in the same place — a control that moves between pages is one the
 * reader has to find again every time.
 *
 * The wordmark is two things depending on where it is pressed. On the home page
 * of whichever app the reader is in — /lessons for staff, /learn for a student —
 * there is nowhere for it to go, so it opens the menu, which is the thing it
 * flies into. Anywhere else it is the mark on every website ever built: a link
 * home. The menu is still one button to its left, and still ⌘K.
 *
 * A page about one named thing can put that name here instead (`title`). It
 * takes the mark's place rather than sitting beside it: two display-face words
 * in one bar read as a lockup, and the page's subject is the more useful of the
 * two to a reader already inside the app. It still goes home when pressed.
 *
 * `titlePrefix` and `titleSuffix` sit flush against it in Montserrat at the same
 * size, so a bar can read "TesteStudio" as one lockup — the name in the body
 * face, what you are doing to it in the display one. The change of face is the
 * seam; there is no space, and none is added.
 */
export function SiteNav({
  backTo,
  backLabel = "Back",
  align = "wide",
  title,
  titlePrefix,
  titleSuffix,
}: {
  /** Where the back arrow goes. Omitted on the home page, which is where the
   *  rest of the app already points. */
  backTo?: LinkTo;
  /** Its accessible name — it has no visible text. */
  backLabel?: string;
  /**
   * Which content column the back arrow lines up with — the page's own
   * `max-w-*`, so the arrow sits directly above the heading beneath it rather
   * than out in the margin. Only affects the arrow: the wordmark is centred on
   * the viewport either way.
   */
  align?: keyof typeof COLUMN;
  /**
   * The name of the thing this page is about — a group, say — shown in the
   * mark's place. Omit it and the bar says "lexicon", which is what every other
   * page does.
   */
  title?: string;
  /** Body-face words before the title — a group's name, say. */
  titlePrefix?: string;
  /** Body-face words after it. */
  titleSuffix?: string;
} = {}) {
  const { toggle, open, flying, registerWordmark } = useSidebar();
  const { profile, isLoading } = useAuth();

  // Which app this reader is in, and so what "home" means. Unknown for the
  // moment before the profile lands — staff is the harmless guess, because the
  // only thing it decides in that window is which page `atHome` compares
  // against, and `linksHome` keeps the mark a menu button until it is sure.
  const home: LinkTo = profile && !isStaff(profile) ? "/learn" : "/lessons";
  const atHome = useRouterState({
    select: (state) => state.location.pathname === home,
  });
  const linksHome = !atHome && !isLoading;

  // One element for both branches below: it carries the ref the sidebar flies
  // the mark from, and swapping which one holds it mid-flight would strand it.
  //
  // Hidden rather than unmounted while the panel has it: the button around it
  // keeps its size, so the header doesn't twitch as the mark leaves and returns.
  // `flying` outlasts `open` on the way back, which is what stops the mark
  // reappearing here before it has landed.
  //
  // A personalized title registers nothing and hides for nothing: the mark that
  // flies into the panel says "lexicon", and flying it out of a word that says
  // something else would be an animation between two different things. The
  // sidebar already handles having nowhere to fly from — several pages have no
  // header at all — and simply arrives with the panel.
  const named = title !== undefined;
  const wordmark = named ? (
    // Baselines, not centres: the two faces are different sizes, and a bar whose
    // words sit on one line is the whole point of mixing them.
    <span className="flex max-w-[60vw] items-baseline">
      {titlePrefix && <TitleAffix>{titlePrefix}</TitleAffix>}
      <span className={cn(WORDMARK, "truncate")}>{title}</span>
      {titleSuffix && <TitleAffix>{titleSuffix}</TitleAffix>}
    </span>
  ) : (
    <span
      ref={registerWordmark}
      className={cn(WORDMARK, (open || flying) && "invisible")}
    >
      lexicon
    </span>
  );

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
      {/* The wordmark is centred on the viewport; the menu button and the back
          arrow are pinned to the left edge of the page's own content column,
          which is a different box. Hence two overlaid containers rather than one
          flex row — a row would have to choose which of the two to centre on. */}
      <div className="relative flex h-14 items-center justify-center">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 mx-auto flex items-center gap-2 px-4",
            COLUMN[align],
          )}
        >
          {/* `-ml-1.5` cancels the button's own padding, so the glyph — not the
              hit area around it — lines up with the heading and the table that
              start at this column's edge below. */}
          <button
            type="button"
            onClick={toggle}
            aria-label="Open the menu"
            aria-keyshortcuts="Meta+K Control+K"
            aria-expanded={open}
            className={cn(
              "pointer-events-auto -ml-1.5 rounded-md p-1.5 text-muted-foreground transition-[opacity,color,background-color] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
              // Gone while the panel is out — it sits under it, and the panel
              // carries its own way closed. Faded rather than unmounted so the
              // back arrow beside it doesn't jump.
              open && "pointer-events-none opacity-0",
            )}
            style={{ transitionDuration: `${SLIDE_MS}ms` }}
          >
            <MenuIcon className="size-5" />
          </button>

          {backTo && (
            <BackButton
              to={backTo}
              label={backLabel}
              className="pointer-events-auto"
            />
          )}
        </div>

        {linksHome ? (
          <Link to={home} className={FOCUS_RING}>
            {wordmark}
          </Link>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Open the menu"
            className={FOCUS_RING}
          >
            {wordmark}
          </button>
        )}
      </div>
    </header>
  );
}

/** One half of a personalized title that isn't the title: the body face, a size
 *  down, so the display word stays the one being read. */
function TitleAffix({ children }: { children: React.ReactNode }) {
  return (
    // Same size, colour and baseline as the title — `WORDMARK` with the face
    // swapped. Spelled out rather than merged onto that constant: two font
    // families in one `cn` is a bet on which utility the stylesheet emits last.
    <span className="truncate font-montserrat text-3xl leading-none font-medium text-primary">
      {children}
    </span>
  );
}
