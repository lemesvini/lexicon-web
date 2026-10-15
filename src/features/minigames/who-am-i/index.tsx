import { useEffect, useRef, useState } from "react";
import { INK, JADE, withAlpha } from "@/features/blocks/brand";
import { cn } from "@/lib/utils";
import { useGameToast } from "../game-toast";
import {
  GAME_INPUT,
  GameButton,
  type GameProps,
  GameHeader,
  GameLinkButton,
  GamePaper,
} from "../game-ui";
import {
  GUEST_SHEET,
  GuestColumn,
  GuestFigure,
  GuestStage,
  PLATE,
  SHEET_HEADING,
} from "../guest-stage";
import { useArmed } from "../use-armed";
import { useGameState } from "../use-game-state";
import {
  MAX_GUESTS,
  allRevealed,
  freshWhoAmI,
  newGuest,
  parseWhoAmI,
  withGuest,
  type Guest,
} from "./model";

// Layout: a row of up to four guests on a stage — the character plate above the
// head (the forehead post-it), the nametag on the chest, a frosted hint sheet
// over the legs. Same tokens as Book One Crossings.

export function WhoAmI({ scope, lead }: GameProps) {
  const { state, commit, undo, canUndo } = useGameState(
    "who-am-i",
    scope,
    parseWhoAmI,
    freshWhoAmI,
  );
  const { show, toast } = useGameToast();
  /** Whose plate is being typed into. Not part of the round: Undo and a reload
   *  both close it. */
  const [editing, setEditing] = useState<string | null>(null);
  /** The guest whose Remove has been pressed once and is waiting for a second. */
  const [armed, setArmed] = useArmed();

  const any = state.guests.some((g) => g.character);
  const allOpen = any && allRevealed(state);

  function update(id: string, change: (g: Guest) => Guest, undoable = true) {
    commit(withGuest(state, id, change), { undoable });
  }

  return (
    <GamePaper>
      <div className="flex min-h-full flex-col gap-[18px] px-[22px] pt-[18px] pb-7">
        <GameHeader
          lead={lead}
          title="Who Am I?"
          subtitle="Yes/no questions only. Write each answer as a hint until someone guesses."
        >
          <div className="flex flex-wrap gap-2">
            <GameButton
              disabled={!canUndo}
              onClick={() => {
                if (!undo()) return;
                setEditing(null);
                setArmed(null);
                show("Undone.");
              }}
            >
              Undo
            </GameButton>
            <GameButton
              disabled={!any}
              onClick={() =>
                commit(
                  {
                    guests: state.guests.map((g) =>
                      g.character ? { ...g, revealed: !allOpen } : g,
                    ),
                  },
                  { undoable: false },
                )
              }
            >
              {allOpen ? "Hide all" : "Reveal all"}
            </GameButton>
            <GameButton
              primary
              onClick={() => {
                commit({
                  guests: state.guests.map((g) => ({
                    ...g,
                    character: "",
                    revealed: false,
                    hints: [],
                  })),
                });
                setEditing(null);
                setArmed(null);
                show("New round. Names kept, characters and hints cleared.");
              }}
            >
              New round
            </GameButton>
          </div>
        </GameHeader>

        <GuestStage
          count={state.guests.length}
          max={MAX_GUESTS}
          onAdd={() => commit({ guests: [...state.guests, newGuest()] })}
        >
          {state.guests.map((g, i) => (
            <GuestCard
              key={g.id}
              guest={g}
              index={i}
              editing={editing === g.id}
              armed={armed === g.id}
              removable={state.guests.length > 1}
              onEdit={() => setEditing(g.id)}
              onCharacter={(value) => {
                setEditing(null);
                if (value === null || !value || value === g.character) return;
                update(g.id, (x) => ({ ...x, character: value, revealed: false }));
                show("Name saved. It stays hidden until Reveal.");
              }}
              onPlayer={(player) => update(g.id, (x) => ({ ...x, player }))}
              onAddHint={(hint) =>
                update(g.id, (x) => ({ ...x, hints: [...x.hints, hint] }))
              }
              onRemoveHint={(k) =>
                update(g.id, (x) => ({
                  ...x,
                  hints: x.hints.filter((_, j) => j !== k),
                }))
              }
              onToggleReveal={() =>
                update(g.id, (x) => ({ ...x, revealed: !x.revealed }), false)
              }
              onRemove={() => {
                if (armed !== g.id) {
                  setArmed(g.id);
                  return;
                }
                commit({ guests: state.guests.filter((x) => x.id !== g.id) });
                setArmed(null);
                show("Removed. Undo brings them back.");
              }}
            />
          ))}
        </GuestStage>
      </div>
      {toast}
    </GamePaper>
  );
}

function GuestCard({
  guest: g,
  index,
  editing,
  armed,
  removable,
  onEdit,
  onCharacter,
  onPlayer,
  onAddHint,
  onRemoveHint,
  onToggleReveal,
  onRemove,
}: {
  guest: Guest;
  index: number;
  editing: boolean;
  armed: boolean;
  removable: boolean;
  onEdit: () => void;
  /** The typed name, or `null` when the edit was abandoned with Escape. */
  onCharacter: (value: string | null) => void;
  onPlayer: (player: string) => void;
  onAddHint: (hint: string) => void;
  onRemoveHint: (index: number) => void;
  onToggleReveal: () => void;
  onRemove: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const count = useRef(g.hints.length);
  const who = g.player || `player ${index + 1}`;

  // A new hint lands at the bottom of a list that may already scroll.
  useEffect(() => {
    if (g.hints.length > count.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
    count.current = g.hints.length;
  }, [g.hints.length]);

  return (
    <GuestColumn label={g.player || `Player ${index + 1}`}>
      {editing ? (
        <PlateInput guest={g} onCommit={onCharacter} />
      ) : (
        <Plate guest={g} onClick={onEdit} />
      )}

      <GuestFigure player={g.player} index={index} onPlayer={onPlayer}>
        <div
          className={cn(
            GUEST_SHEET,
            "max-h-[340px] min-h-[236px] px-3.5 pt-3.5 pb-3",
          )}
        >
          <h2 className={SHEET_HEADING}>
            Hints
            <span className="tracking-normal tabular-nums">
              {g.hints.length || ""}
            </span>
          </h2>

          {g.hints.length ? (
            <ul
              ref={listRef}
              className="m-0 flex min-h-0 flex-1 list-none flex-col gap-[5px] overflow-auto p-0"
            >
              {g.hints.map((text, k) => (
                <li
                  key={`${k}-${text}`}
                  className="group flex items-start gap-2 rounded-lg px-1.5 py-[5px] text-[15px] leading-[1.3] font-semibold animate-in fade-in-40 slide-in-from-bottom-2 duration-250 hover:bg-accent/60 motion-reduce:animate-none"
                >
                  <span className="min-w-3.5 pt-[3px] text-[11px] text-muted-foreground tabular-nums">
                    {k + 1}
                  </span>
                  <span className="min-w-0 flex-1 wrap-anywhere">{text}</span>
                  <button
                    type="button"
                    aria-label={`Remove hint ${k + 1}`}
                    onClick={() => onRemoveHint(k)}
                    className="cursor-pointer rounded-md border-0 bg-transparent px-1 py-px text-base leading-none text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="my-auto px-1 py-2.5 text-center text-[13px] text-muted-foreground">
              Each yes or no becomes a hint here.
            </p>
          )}

          <input
            type="text"
            maxLength={60}
            placeholder="Add a hint, press Enter"
            aria-label={`Add a hint for ${who}`}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = e.currentTarget.value.trim();
              if (!v) return;
              onAddHint(v);
              e.currentTarget.value = "";
            }}
            className={GAME_INPUT}
          />
        </div>
      </GuestFigure>

      <div className="flex w-full items-center justify-center gap-2">
        <GameButton
          primary={!g.revealed}
          disabled={!g.character}
          onClick={onToggleReveal}
          className="max-w-[150px] flex-1"
        >
          {g.revealed ? "Hide" : "Reveal"}
        </GameButton>
        {removable && (
          <GameLinkButton data-remove warn={armed} onClick={onRemove}>
            {armed ? "Click again to remove" : "Remove"}
          </GameLinkButton>
        )}
      </div>
    </GuestColumn>
  );
}

/** The forehead post-it: unset, hidden (???), or revealed in the brand green. */
function Plate({ guest: g, onClick }: { guest: Guest; onClick: () => void }) {
  const base = cn(
    PLATE,
    "cursor-pointer transition-[background-color,border-color,transform] duration-200",
  );

  if (!g.character) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Set the character's name"
        className={cn(
          base,
          "border-2 border-dashed border-input bg-transparent text-muted-foreground hover:border-ring",
        )}
      >
        Set the name
      </button>
    );
  }

  if (g.revealed) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Character: ${g.character}. Click to change`}
        className={cn(
          base,
          "border-2 animate-in zoom-in-[0.86] duration-500 motion-reduce:animate-none",
        )}
        style={{
          background: JADE,
          borderColor: JADE,
          color: INK,
          boxShadow: `0 0 0 6px ${withAlpha(JADE, 0.28)}, 0 10px 28px hsl(0 0% 0% / .16)`,
        }}
      >
        <span className="font-display text-[clamp(22px,2.2cqw,32px)] leading-[1.05] font-normal text-balance wrap-anywhere">
          {g.character}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Hidden character. Click to change the name"
      className={cn(base, "border-2 border-border bg-muted text-muted-foreground")}
    >
      <span className="pl-[0.3em] font-display text-[30px] leading-none tracking-[0.3em]">
        ???
      </span>
    </button>
  );
}

/**
 * Typing a character's name with the room watching.
 *
 * The letters are drawn as dots — the player whose forehead it is may well be
 * looking at the screen. Enter or leaving the field saves; Escape keeps whatever
 * was there before.
 */
function PlateInput({
  guest: g,
  onCommit,
}: {
  guest: Guest;
  onCommit: (value: string | null) => void;
}) {
  // Enter commits and unmounts the field, and some browsers then fire a blur on
  // the way out. The guard makes the second one a no-op.
  const done = useRef(false);
  function finish(value: string | null) {
    if (done.current) return;
    done.current = true;
    onCommit(value);
  }

  return (
    <input
      type="text"
      autoFocus
      autoComplete="off"
      spellCheck={false}
      autoCapitalize="words"
      maxLength={40}
      placeholder={
        g.character
          ? "Type a new name, Esc keeps it"
          : "Who is it? Typing stays hidden"
      }
      aria-label="Character name (hidden while typing)"
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(e.currentTarget.value.trim());
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.target.value.trim())}
      className="min-h-[58px] w-full rounded-[10px] border-2 border-ring bg-card px-3 py-2 text-center text-lg font-bold outline-none [-webkit-text-security:disc] placeholder:text-[13px] placeholder:font-medium placeholder:text-muted-foreground placeholder:[-webkit-text-security:none]"
    />
  );
}
