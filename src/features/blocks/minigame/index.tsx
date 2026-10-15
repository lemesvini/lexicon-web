import { Gamepad2Icon } from "lucide-react";
import type { LessonSlide, MinigameBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import {
  MINIGAMES,
  MINIGAME_ORDER,
  isMinigameId,
} from "@/features/minigames/registry";
import type { Audience, BlockDefinition } from "../types";
import { BlockLabel, BlockNote } from "../view-ui";
import { Segmented } from "../editor-ui/segmented";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

// One of our own games on the slide. See `MinigameBlock` in @/lib/lessons. The
// game itself lives in @/features/minigames and is the same component the
// /minigames page shows; this module only decides how much of the slide it gets.
//
// In a presentation the projector and the teacher's control device play ONE
// round, kept in step over the presentation's channel — the present and control
// pages provide the `MinigameSync` that does it (see @/features/minigames/sync),
// and the game picks it up from context. The control device doesn't play the
// scaled-down copy in its slide preview but the game itself, full size — see
// `slideMinigame`.
//
// Anywhere else there is no session, and the game keeps a round of its own in
// the browser: the studio's slide previews one, a student's material another.

/** The game for a block, or nothing for an id this build doesn't know — a
 *  document written by a newer version should not take the slide down. */
function gameFor(block: MinigameBlock) {
  return isMinigameId(block.game) ? MINIGAMES[block.game] : null;
}

function Unknown({ game }: { game: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Gamepad2Icon className="size-8" />
      <span className="text-sm">Unknown game “{game}”</span>
    </div>
  );
}

/** The round a slide plays outside a presentation (inside one, the session's
 *  scope wins): a scratch one where a teacher is only looking at the slide, and
 *  the student's own in their material. */
function scopeFor(audience: Audience): string {
  return audience === "student" ? "material" : "preview";
}

/**
 * The minigame a slide is built around, if it has one — for the control device,
 * which shows that game at full size in place of its slide preview. A stage
 * scaled to a tablet's column leaves a game's buttons too small to press.
 */
export function slideMinigame(slide: LessonSlide) {
  for (const block of slide.blocks) {
    if (block.type === "minigame") return gameFor(block);
  }
  return null;
}

function View({ block, audience }: { block: MinigameBlock; audience: Audience }) {
  const def = gameFor(block);
  const game = def ? (
    <def.Game scope={scopeFor(audience)} />
  ) : (
    <Unknown game={block.game} />
  );

  // Full-bleed: SlideView lifts this block out of the flow and hands it the
  // whole stage, exactly as it does a filling embed.
  if (block.fill) return <div className="h-full w-full">{game}</div>;

  return (
    <figure className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      {/* A game has no natural height, so in the flow it gets the stage's own
          shape and scrolls inside it. */}
      <div className="aspect-video w-full overflow-hidden rounded-xl border">
        {game}
      </div>
      {block.note && <BlockNote text={block.note} />}
    </figure>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: MinigameBlock;
  onChange: (b: MinigameBlock) => void;
}) {
  const def = gameFor(block);
  const Icon = def?.icon ?? Gamepad2Icon;

  return (
    <div className="space-y-1.5">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      {/* Not the live game: the slide preview above already runs it, and a
          second copy here would be a second round fighting the first. */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/10 p-3 text-primary">
        <Icon className="size-6 shrink-0 opacity-90" />
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">
            {def?.title ?? block.game}
          </p>
          <p className="text-xs opacity-80">
            {def?.description ?? "This game isn't available in this version."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
        <Segmented
          label="Game"
          className="flex-wrap"
          value={block.game}
          onChange={(game) => onChange({ ...block, game })}
          options={MINIGAME_ORDER.map((id) => ({
            value: id,
            label: MINIGAMES[id].title,
            icon: MINIGAMES[id].icon,
          }))}
        />
        <button
          type="button"
          onClick={() =>
            onChange({ ...block, fill: block.fill ? undefined : true })
          }
          title="Take the whole slide, edge to edge"
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
            block.fill
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          Full slide
        </button>
      </div>

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const minigameBlock: BlockDefinition<MinigameBlock> = {
  meta: {
    type: "minigame",
    label: "Minigame",
    hint: "Play one of the classroom games on the slide — Who Am I, Two Truths, Word Cards, Crossings",
    icon: Gamepad2Icon,
  },
  // Full slide by default: a game is a whole screen of controls, and squeezed
  // into the content column it is mostly scrollbar.
  create: () => ({ type: "minigame", game: "who-am-i", fill: true }),
  View,
  Editor,
};
