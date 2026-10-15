import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { GameNav } from "@/features/minigames/game-nav";
import { MINIGAMES, isMinigameId } from "@/features/minigames/registry";

export const Route = createFileRoute("/_authenticated/_admin/minigames/$gameId")({
  component: MinigamePage,
});

/** One game, filling the window — the projector view. */
function MinigamePage() {
  const { gameId } = Route.useParams();

  if (!isMinigameId(gameId)) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground">
        <SiteNav back />
        <main className="mx-auto w-full max-w-6xl px-4 py-10">
          <p className="text-sm text-muted-foreground">
            There is no game called “{gameId}”.
          </p>
        </main>
      </div>
    );
  }

  const { Game } = MINIGAMES[gameId];

  // No SiteNav: the game's header is the page's only bar, and carries the menu,
  // the way back and the mark itself — see GameNav.
  return (
    <div className="h-[100dvh] bg-background text-foreground">
      <Game lead={<GameNav />} />
    </div>
  );
}
