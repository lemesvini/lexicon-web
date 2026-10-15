import { useState } from "react";
import { Maximize2Icon, Minimize2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MinigameDefinition } from "@/features/minigames/registry";
import { cn } from "@/lib/utils";

/** Fullscreen, where the browser allows it. iPad Safari only grew the standard
 *  method in 16.4 and may refuse; the panel covers the screen either way. */
function enterFullscreen() {
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
  };
  try {
    if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    else root.webkitRequestFullscreen?.();
  } catch {
    // Refused: the fixed panel is still the whole viewport.
  }
}

function exitFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/**
 * The slide's minigame on the control device, at full size and playable.
 *
 * It plays the same round as the projector (the page provides the session's
 * `MinigameSync`), so this is the teacher's remote for it: type a Who Am I
 * character the room can't see, deal Crossings squares, mark a lie — and the
 * projector follows.
 *
 * A game wants more room than the control's column, so it can take the whole
 * screen. The toggle sits at the head of the game's own header (its `lead`),
 * where it is in the same place in both states.
 */
export function MinigamePanel({ game }: { game: MinigameDefinition }) {
  const [full, setFull] = useState(false);

  const toggle = (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0 rounded-full"
      aria-label={full ? "Leave full screen" : "Play full screen"}
      title={full ? "Leave full screen" : "Play full screen"}
      onClick={() => {
        if (full) exitFullscreen();
        else enterFullscreen();
        setFull(!full);
      }}
    >
      {full ? <Minimize2Icon /> : <Maximize2Icon />}
    </Button>
  );

  return (
    <div
      className={cn(
        full
          ? "fixed inset-0 z-50 bg-background"
          : "min-h-[560px] flex-1 shrink-0 overflow-hidden rounded-lg border-2 border-primary/40",
      )}
    >
      <game.Game lead={toggle} />
    </div>
  );
}
