import { useEffect, useRef, useState } from "react";
import { FOREST, INK, JADE, MIST } from "@/features/blocks/brand";
import { cn } from "@/lib/utils";
import { useGameToast } from "../game-toast";
import {
  AddTile,
  GAME_HEADING,
  GameField,
  GameSelect,
  GAME_INPUT,
  GameButton,
  type GameProps,
  GameDialog,
  GameDialogTitle,
  GameHeader,
  GameLinkButton,
  GamePaper,
} from "../game-ui";
import { copyText } from "../clipboard";
import { useArmed } from "../use-armed";
import { useGameState } from "../use-game-state";
import { BOARDS, BOARD_KEYS, type BoardKey } from "./boards";
import {
  LETTERS,
  MAX_PLAYERS,
  cardText,
  deal,
  freshCrossings,
  guess,
  isOver,
  newGame,
  parseCrossings,
  pendingCount,
  placedCount,
  rating,
  renamePlayers,
  wordsOf,
  type BoardSize,
  type Cell,
  type ClueRule,
  type CrossingsState,
} from "./model";

/** A player card's height, which the add tile matches. Tall enough for the
 *  name row and the button row; an active card (with its clue field) grows
 *  past it. */
const CARD_HEIGHT = "min-h-[100px]";

export function Crossings({ scope, lead }: GameProps) {
  const { state, commit, undo, canUndo } = useGameState(
    "crossings",
    scope,
    parseCrossings,
    freshCrossings,
  );
  const { show, toast } = useGameToast(2600);
  /** The player whose × has been pressed once and waits for a second. */
  const [armed, setArmed] = useArmed();
  /** A player just added from the tile, whose name field opens focused. */
  const [added, setAdded] = useState<string | null>(null);
  const [clue, setClue] = useState("");
  const [flash, setFlash] = useState<{ coord: string; n: number } | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  // The board is finished when `endShown` turns on — here, or on the other
  // device in a presentation. Watching the flag rather than the last guess is
  // what opens the dialog on both. Adjusted during render, React's alternative
  // to setting state from an effect.
  const [seenEnd, setSeenEnd] = useState(state.endShown);
  if (state.endShown !== seenEnd) {
    setSeenEnd(state.endShown);
    if (state.endShown) setEndOpen(true);
  }
  /** The square a failed copy couldn't deliver, and whether it is on screen. */
  const [peek, setPeek] = useState<{ coord: string; shown: boolean } | null>(
    null,
  );

  const total = state.size * state.size;
  const placed = placedCount(state);
  const burned = Object.keys(state.cells).length - placed;

  // Escape closes whatever is open over the board and stands the guess down.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEndOpen(false);
      setPeek(null);
      if (state.active) commit({ ...state, active: null }, { undoable: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, commit]);

  function sendCard(s: CrossingsState, player: string) {
    const coord = s.hands[player];
    if (!coord) return;
    void copyText(cardText(s, coord)).then((ok) => {
      if (ok) show(`Copied for ${player}. Paste it in ${player}'s WhatsApp.`);
      else setPeek({ coord, shown: false });
    });
  }

  function onDeal(player: string) {
    if (state.hands[player]) return sendCard(state, player);
    if (!state.deck.length) return show("No squares left in the deck.");
    const next = deal(state, player);
    commit(next);
    sendCard(next, player);
  }

  function onSetActive(player: string) {
    if (!state.hands[player]) return;
    const active = state.active === player ? null : player;
    setClue("");
    commit(
      {
        ...state,
        active,
        status: active
          ? {
              kind: "",
              text: `${player} is giving a clue. Click the square the others agree on.`,
            }
          : state.status,
      },
      { undoable: false },
    );
  }

  function onGuess(coord: string) {
    if (!state.active) {
      show("First choose whose clue it is: press Guess next to their name.");
      return;
    }
    if (state.cells[coord]) return;
    const { next, right, flash: at } = guess(state, coord, clue.trim());
    const ended = isOver(next) && !next.endShown;
    commit(ended ? { ...next, endShown: true } : next);
    setFlash({ coord: right ? coord : at, n: Date.now() });
  }

  function resetTo(boardKey: BoardKey, size: BoardSize) {
    const started = Object.keys(state.cells).length > 0 || pendingCount(state) > 0;
    commit(newGame(boardKey, size, state.rule, state.players), {
      undoable: started,
    });
    setEndOpen(false);
    if (started) show("New board. Undo brings the last one back.");
  }

  /** Renames a player in place. False when the name was refused, so the card
   *  puts the old one back. */
  function onRename(player: string, value: string): boolean {
    const name = value.trim();
    if (!name || name === player) return false;
    if (state.players.includes(name)) {
      show(`There's already a player called ${name}.`);
      return false;
    }
    commit(
      renamePlayers(
        state,
        state.players.map((p) => (p === player ? name : p)),
      ),
    );
    return true;
  }

  function onAddPlayer() {
    let n = state.players.length + 1;
    while (state.players.includes(`Player ${n}`)) n++;
    const name = `Player ${n}`;
    commit(renamePlayers(state, [...state.players, name]));
    setAdded(name);
  }

  function onRemove(player: string) {
    if (armed !== player) return setArmed(player);
    // A removed player's square goes back to the deck — see renamePlayers.
    commit(renamePlayers(state, state.players.filter((p) => p !== player)));
    setArmed(null);
    show("Removed. Undo brings them back.");
  }

  return (
    <GamePaper>
      <div className="grid gap-x-[22px] gap-y-3.5 px-[22px] py-[18px] @4xl:h-full @4xl:grid-cols-[minmax(0,1fr)_300px] @4xl:grid-rows-[auto_minmax(0,1fr)]">
        <GameHeader
          lead={lead}
          title="Book One Crossings"
          subtitle="One secret square each. One clue that links its two words."
          className="@4xl:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <GameField label="Unit">
              <GameSelect
                aria-label="Unit"
                value={state.boardKey}
                onChange={(e) => resetTo(e.target.value as BoardKey, state.size)}
              >
                {BOARD_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BOARDS[k].name}
                  </option>
                ))}
              </GameSelect>
            </GameField>
            <GameField label="Size">
              <Seg
                label="Board size"
                value={state.size}
                options={[
                  [4, "4 × 4"],
                  [5, "5 × 5"],
                ]}
                onChange={(n) => n !== state.size && resetTo(state.boardKey, n)}
              />
            </GameField>
            <GameField label="Clue">
              <Seg<ClueRule>
                label="Clue rule"
                value={state.rule}
                options={[
                  ["one", "One word"],
                  ["three", "Up to three"],
                ]}
                onChange={(rule) =>
                  commit({ ...state, rule }, { undoable: false })
                }
              />
            </GameField>
            <GameField label={" "}>
              <div className="flex gap-2">
                <GameButton
                  disabled={!canUndo}
                  onClick={() => {
                    const back = undo();
                    if (!back) return;
                    if (back.endShown) commit({ ...back, endShown: false }, { undoable: false });
                    setEndOpen(false);
                    show("Undone.");
                  }}
                >
                  Undo
                </GameButton>
                <GameButton
                  primary
                  onClick={() => resetTo(state.boardKey, state.size)}
                >
                  New game
                </GameButton>
              </div>
            </GameField>
          </div>
        </GameHeader>

        <section className="flex min-h-0 flex-col gap-2.5">
          <div
            aria-label="Game board"
            className="grid h-[70vh] gap-[7px] @4xl:h-auto @4xl:min-h-0 @4xl:flex-1"
            style={{
              gridTemplateColumns: `minmax(90px,.8fr) repeat(${state.size},minmax(0,1fr))`,
              gridTemplateRows: `minmax(54px,.62fr) repeat(${state.size},minmax(0,1fr))`,
            }}
          >
            <div />
            {state.cols.map((w, i) => (
              <div
                key={`c${i}`}
                className="flex min-w-0 flex-col items-center justify-center rounded-[10px] px-2.5 py-1.5 text-center"
                style={{ background: FOREST, color: MIST }}
              >
                <span className="text-xs font-semibold opacity-80">
                  {LETTERS[i]}
                </span>
                <HeadWord>{w}</HeadWord>
              </div>
            ))}
            {state.rows.map((rw, ri) => (
              <RowCells
                key={`r${ri}`}
                state={state}
                word={rw}
                index={ri}
                flash={flash}
                onGuess={onGuess}
              />
            ))}
          </div>
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold",
              state.status.kind === "good" ? "bg-accent" : "bg-muted",
              state.status.kind === "bad" &&
                "shadow-[inset_4px_0_0_var(--destructive)]",
            )}
          >
            {state.status.text}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <Panel>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[44px] leading-none text-primary">
                {placed}
              </span>
              <span className="font-semibold text-muted-foreground">
                of {total} squares
              </span>
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">
              {state.deck.length} left in the deck · {pendingCount(state)} in
              hand · {burned} lost
            </p>
          </Panel>

          <section aria-label="Players" className="flex flex-col gap-2">
            <h2 className="m-0 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
              Players
            </h2>
            {state.players.map((p) => (
              <PlayerCard
                key={p}
                state={state}
                player={p}
                clue={clue}
                fresh={added === p}
                armed={armed === p}
                removable={state.players.length > 1}
                onClue={setClue}
                onDeal={() => onDeal(p)}
                onGuess={() => onSetActive(p)}
                onRename={(value) => {
                  setAdded(null);
                  return onRename(p, value);
                }}
                onRemove={() => onRemove(p)}
              />
            ))}
            {state.players.length < MAX_PLAYERS && (
              <AddTile
                count={state.players.length}
                max={MAX_PLAYERS}
                onClick={onAddPlayer}
                className={cn("w-full shrink-0 rounded-xl", CARD_HEIGHT)}
                glyphClassName="w-7"
              />
            )}
          </section>

        </aside>
      </div>

      {toast}

      <GameDialog open={endOpen} labelledBy="crossings-end">
        <GameDialogTitle id="crossings-end">Board complete</GameDialogTitle>
        <p className="mb-3.5">
          {placed} of {total} squares on the board. {rating(placed, total)}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <GameButton autoFocus onClick={() => setEndOpen(false)}>
            Look at the board
          </GameButton>
          <GameButton
            primary
            onClick={() => resetTo(state.boardKey, state.size)}
          >
            New game
          </GameButton>
        </div>
      </GameDialog>

      <GameDialog open={peek !== null} labelledBy="crossings-peek">
        <GameDialogTitle id="crossings-peek">Copying didn't work</GameDialogTitle>
        <p className="mb-3.5">
          This shows the square on screen. Only open it if you're not sharing
          this window, or open the page in its own tab and try Copy again.
        </p>
        {peek?.shown && (
          <div
            className={cn("my-2 text-center font-display text-[64px]", GAME_HEADING)}
            title={`${wordsOf(state, peek.coord).col} and ${wordsOf(state, peek.coord).row}`}
          >
            {peek.coord}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <GameButton autoFocus onClick={() => setPeek(null)}>
            Close
          </GameButton>
          <GameButton
            primary
            onClick={() => peek && setPeek({ ...peek, shown: true })}
          >
            Show the square
          </GameButton>
        </div>
      </GameDialog>
    </GamePaper>
  );
}

function HeadWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[clamp(14px,1.55cqw,22px)] leading-[1.1] font-bold tracking-[-0.02em] wrap-anywhere">
      {children}
    </span>
  );
}

/** One row of the board: its word, then a square per column. `display:
 *  contents` keeps the cells on the board's own grid. */
function RowCells({
  state,
  word,
  index,
  flash,
  onGuess,
}: {
  state: CrossingsState;
  word: string;
  index: number;
  flash: { coord: string; n: number } | null;
  onGuess: (coord: string) => void;
}) {
  return (
    <div className="contents">
      <div
        className="flex min-w-0 flex-col justify-center rounded-[10px] px-2.5 py-1.5"
        style={{ background: MIST, color: FOREST }}
      >
        <span className="text-xs font-semibold opacity-80">{index + 1}</span>
        <HeadWord>{word}</HeadWord>
      </div>
      {state.cols.map((cw, ci) => {
        const coord = LETTERS[ci] + (index + 1);
        return (
          <Square
            key={coord}
            coord={coord}
            words={`${cw} and ${word}`}
            cell={state.cells[coord]}
            guessing={Boolean(state.active)}
            flash={flash?.coord === coord ? flash.n : 0}
            onClick={() => onGuess(coord)}
          />
        );
      })}
    </div>
  );
}

function Square({
  coord,
  words,
  cell,
  guessing,
  flash,
  onClick,
}: {
  coord: string;
  words: string;
  cell: Cell | undefined;
  guessing: boolean;
  /** Changes each time this square should pulse; 0 for never. */
  flash: number;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!flash || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.06)", offset: 0.3 },
        { transform: "scale(1)" },
      ],
      { duration: 900, easing: "ease" },
    );
  }, [flash]);

  const placed = cell?.status === "placed";
  const burned = cell?.status === "burned";

  return (
    <button
      ref={ref}
      type="button"
      disabled={Boolean(cell)}
      onClick={onClick}
      aria-label={`${coord}, ${words}${
        cell ? (placed ? `, placed: ${cell.clue || "no clue typed"}` : ", lost") : ", open"
      }`}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] border p-1 transition-[background-color,box-shadow,transform] duration-150",
        !cell && "border-border bg-card",
        !cell && guessing && "cursor-pointer hover:bg-accent hover:shadow-[inset_0_0_0_2px_var(--ring)]",
        !cell && !guessing && "cursor-default",
        burned && "border-border text-muted-foreground",
      )}
      style={
        placed
          ? { background: JADE, borderColor: JADE, color: INK }
          : burned
            ? {
                background:
                  "repeating-linear-gradient(135deg, color-mix(in oklch, var(--foreground) 8%, transparent) 0 6px, transparent 6px 12px), var(--muted)",
              }
            : undefined
      }
    >
      <span
        className={cn(
          "text-xs font-semibold",
          placed ? "opacity-70" : "text-muted-foreground",
          burned && "line-through",
        )}
      >
        {coord}
      </span>
      {placed && cell.clue && (
        <span className="text-center text-[clamp(13px,1.45cqw,21px)] leading-[1.1] font-bold tracking-[-0.02em] wrap-anywhere">
          {cell.clue}
        </span>
      )}
      {cell && (placed || cell.clue) && (
        <span className="text-[11px] font-semibold opacity-75">
          {placed ? cell.by : cell.clue}
        </span>
      )}
    </button>
  );
}

/**
 * One player: their name (click to rename), whether they hold a square, and
 * what can be done with it. The active card — the player whose clue the room is
 * guessing — is tinted and carries the clue field.
 */
function PlayerCard({
  state,
  player: p,
  clue,
  fresh,
  armed,
  removable,
  onClue,
  onDeal,
  onGuess,
  onRename,
  onRemove,
}: {
  state: CrossingsState;
  player: string;
  clue: string;
  /** Just added: open with the name selected, ready to be typed over. */
  fresh: boolean;
  armed: boolean;
  removable: boolean;
  onClue: (v: string) => void;
  onDeal: () => void;
  onGuess: () => void;
  onRename: (value: string) => boolean;
  onRemove: () => void;
}) {
  const square = state.hands[p];
  const active = state.active === p;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col justify-center gap-2 rounded-xl border p-3.5",
        CARD_HEIGHT,
        active ? "border-ring bg-accent" : "bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        {/* Uncontrolled and committed on blur, like Who Am I's nametag: a
            rename is one Undo step, not one per letter. */}
        <input
          type="text"
          defaultValue={p}
          maxLength={24}
          autoFocus={fresh}
          title="Click to rename"
          aria-label={`${p}'s name`}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            if (!onRename(e.target.value)) e.target.value = p;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = p;
              e.currentTarget.blur();
            }
          }}
          className="-ml-1.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-bold outline-none hover:border-input focus:border-ring focus:bg-card"
        />
        <span
          className={cn(
            "shrink-0 text-xs font-semibold",
            square ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {square ? "Square in hand" : "No square"}
        </span>
        {removable &&
          (armed ? (
            <GameLinkButton data-remove warn onClick={onRemove} className="shrink-0 py-0">
              Remove?
            </GameLinkButton>
          ) : (
            <button
              type="button"
              data-remove
              aria-label={`Remove ${p}`}
              onClick={onRemove}
              className="-mr-1 shrink-0 cursor-pointer rounded-md border-0 bg-transparent px-1 text-base leading-none text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <GameButton
          className="px-2.5 py-1.5 text-xs"
          disabled={!square && !state.deck.length}
          onClick={onDeal}
        >
          {square ? "Copy again" : "Deal a square"}
        </GameButton>
        {square && (
          <>
            <GameButton
              primary={!active}
              className="px-2.5 py-1.5 text-xs"
              onClick={onGuess}
            >
              {active ? "Cancel" : "Guess"}
            </GameButton>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(cardText(state, square))}`}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-semibold no-underline hover:bg-muted"
            >
              WhatsApp
            </a>
          </>
        )}
      </div>
      {active && (
        <>
          <input
            type="text"
            autoFocus
            value={clue}
            maxLength={40}
            placeholder={`${p}'s clue (optional)`}
            aria-label={`${p}'s clue`}
            onChange={(e) => onClue(e.target.value)}
            className={GAME_INPUT}
          />
          <p className="m-0 text-xs text-muted-foreground">
            Type the clue, then click the square the group chose.
          </p>
        </>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-3.5">{children}</div>;
}

function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-input bg-card"
    >
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={cn(
            "cursor-pointer border-0 px-[11px] py-[7px] text-[13px] font-semibold",
            v === value
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-muted-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
