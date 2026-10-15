import { Link, createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";
import { MINIGAMES, MINIGAME_ORDER } from "@/features/minigames/registry";

export const Route = createFileRoute("/_authenticated/_admin/minigames/")({
  component: MinigamesPage,
});

/**
 * The classroom games, to open on the projector between slides — or to put on a
 * slide of their own with the Studio's Minigame block.
 */
function MinigamesPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav back />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Minigames</h1>
          <p className="text-sm text-muted-foreground">
            Games to play with the room. Each one remembers where you left it on
            this computer.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MINIGAME_ORDER.map((id) => {
            const { title, description, icon: Icon } = MINIGAMES[id];
            return (
              <Link
                key={id}
                to="/minigames/$gameId"
                params={{ gameId: id }}
                className={cn(
                  "flex aspect-square w-full flex-col justify-between overflow-hidden rounded-xl border p-4 text-left shadow-sm",
                  "border-primary/15 bg-primary/10 text-primary",
                  "transition-all hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                )}
              >
                <Icon className="size-6 opacity-90" />
                <div className="space-y-0.5">
                  <h2 className="font-display text-lg leading-tight tracking-tight break-words sm:text-xl">
                    {title}
                  </h2>
                  <p className="line-clamp-3 font-montserrat text-sm opacity-80">
                    {description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
