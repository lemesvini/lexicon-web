import { MenuIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { GAME_TITLE_HEIGHT } from "./game-ui";

/**
 * The app's way around — menu, back, the mark — for a game shown as a page.
 *
 * A game page has one bar, the game's own: the app bar above it would be a
 * second row of chrome over a screen that wants every pixel for the board. So
 * instead of `SiteNav`, these three go at the head of the game's header (its
 * `lead`). On a slide there is no app to get around, and the game is drawn
 * without them.
 *
 * The square mark rather than the "lexicon" wordmark: it sits beside the game's
 * title, and two display-face words in a row would read as one long name.
 */
export function GameNav() {
  const { toggle, open } = useSidebar();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label="Open the menu"
        aria-keyshortcuts="Meta+K Control+K"
        aria-expanded={open}
        className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MenuIcon className="size-5" />
      </button>
      <BackButton />
      {/* As tall as the title block beside it, so the two read as one lockup. */}
      <img
        src="/new-light.svg"
        alt="lexicon"
        className={cn("ml-1 w-auto", GAME_TITLE_HEIGHT)}
      />
    </div>
  );
}
