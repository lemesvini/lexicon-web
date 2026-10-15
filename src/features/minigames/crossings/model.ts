import { BOARDS, BOARD_KEYS, type BoardKey } from "./boards";

// Book One Crossings: a grid of column words × row words. Each player is dealt
// one secret square (privately, over WhatsApp) and gives a one-word clue that
// links its two words. The others agree on a square: right puts the clue on the
// board, wrong loses that square.

export type BoardSize = 4 | 5;
export type ClueRule = "one" | "three";

export type Cell = { status: "placed" | "burned"; clue: string; by: string };

export type CrossingsState = {
  boardKey: BoardKey;
  size: BoardSize;
  rule: ClueRule;
  players: string[];
  cols: string[];
  rows: string[];
  /** Coordinates not yet dealt, e.g. "C4". Dealt from the end. */
  deck: string[];
  cells: Record<string, Cell>;
  /** Each player's square, or null when they have none. */
  hands: Record<string, string | null>;
  /** Whose clue the room is guessing. */
  active: string | null;
  status: { kind: "" | "good" | "bad"; text: string };
  endShown: boolean;
};

export const LETTERS = "ABCDE";
/** How many players a board takes. The names form offers this many rows. */
export const MAX_PLAYERS = 6;
const DEFAULT_PLAYERS = ["Student", "Teacher"];
const START_STATUS = "Deal a square to each player to start.";

function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uniq<T>(a: T[]): T[] {
  return a.filter((x, i) => a.indexOf(x) === i);
}

function wordsFor(boardKey: BoardKey, n: number) {
  const units =
    boardKey === "all" ? BOARD_KEYS.filter((k) => k !== "all") : [boardKey];
  const cols = units.flatMap((k) => BOARDS[k].cols);
  const rows = units.flatMap((k) => BOARDS[k].rows);
  const c = shuffle(uniq(cols)).slice(0, n);
  const r = shuffle(uniq(rows).filter((w) => !c.includes(w))).slice(0, n);
  return { cols: c, rows: r };
}

export function newGame(
  boardKey: BoardKey,
  size: BoardSize,
  rule: ClueRule = "one",
  players: string[] = DEFAULT_PLAYERS,
): CrossingsState {
  const w = wordsFor(boardKey, size);
  const deck: string[] = [];
  for (let c = 0; c < size; c++)
    for (let r = 1; r <= size; r++) deck.push(LETTERS[c] + r);
  const list = players.length ? players.slice() : DEFAULT_PLAYERS.slice();
  return {
    boardKey,
    size,
    rule,
    players: list,
    cols: w.cols,
    rows: w.rows,
    deck: shuffle(deck),
    cells: {},
    hands: Object.fromEntries(list.map((p) => [p, null])),
    active: null,
    status: { kind: "", text: START_STATUS },
    endShown: false,
  };
}

export function freshCrossings(): CrossingsState {
  return newGame("u1", 5, "one");
}

/** A stored game, if it still looks like one. */
export function parseCrossings(raw: unknown): CrossingsState | null {
  const s = raw as CrossingsState | null;
  if (!s || !s.cols || !s.deck || !s.hands || !(s.boardKey in BOARDS))
    return null;
  if (!s.players || !s.players.length) s.players = Object.keys(s.hands);
  return s;
}

export function wordsOf(state: CrossingsState, coord: string) {
  return {
    col: state.cols[LETTERS.indexOf(coord[0])],
    row: state.rows[parseInt(coord.slice(1), 10) - 1],
  };
}

export function placedCount(state: CrossingsState): number {
  return Object.values(state.cells).filter((c) => c.status === "placed").length;
}

export function pendingCount(state: CrossingsState): number {
  return state.players.filter((p) => state.hands[p]).length;
}

/** The deck is out and nobody holds a square: the board is done. */
export function isOver(state: CrossingsState): boolean {
  return !state.deck.length && !pendingCount(state);
}

/** The private message a player is sent with their square. */
export function cardText(state: CrossingsState, coord: string): string {
  const w = wordsOf(state, coord);
  const rule = state.rule === "one" ? "ONE word" : "up to THREE words";
  return (
    `Book One Crossings\nYour square: ${coord}\n` +
    `${coord[0]} = ${w.col}\n${coord.slice(1)} = ${w.row}\n` +
    `Give ${rule} that links both. Don't show this to anyone.`
  );
}

/** Deals the top of the deck to a player who has no square. */
export function deal(state: CrossingsState, player: string): CrossingsState {
  const deck = state.deck.slice();
  const coord = deck.pop() ?? null;
  return { ...state, deck, hands: { ...state.hands, [player]: coord } };
}

/** The room's guess at the active player's square. */
export function guess(
  state: CrossingsState,
  coord: string,
  clue: string,
): { next: CrossingsState; right: boolean; flash: string } {
  const p = state.active as string;
  const target = state.hands[p] as string;
  const w = wordsOf(state, target);
  const right = coord === target;
  const next: CrossingsState = {
    ...state,
    cells: {
      ...state.cells,
      [target]: { status: right ? "placed" : "burned", clue, by: p },
    },
    hands: { ...state.hands, [p]: null },
    active: null,
    status: right
      ? {
          kind: "good",
          text: `Right: ${coord}, ${w.col} and ${w.row}. ${p}, say why in one full sentence.`,
        }
      : {
          kind: "bad",
          text: `Not ${coord}. It was ${target}: ${w.col} and ${w.row}. That square is lost.`,
        },
  };
  return { next, right, flash: target };
}

/**
 * The player list after "Edit names".
 *
 * A name that stays keeps its square. A renamed slot (its old name gone from the
 * list) keeps the old square. A removed player's square goes back to the deck.
 */
export function renamePlayers(
  state: CrossingsState,
  names: string[],
): CrossingsState {
  const old = state.players;
  const hands: Record<string, string | null> = {};
  const used: Record<string, string> = {};
  names.forEach((n, i) => {
    const src = old.includes(n)
      ? n
      : old[i] && !names.includes(old[i])
        ? old[i]
        : null;
    hands[n] = src ? (state.hands[src] ?? null) : null;
    if (src) used[src] = n;
  });
  const deck = state.deck.slice();
  old.forEach((o) => {
    const square = state.hands[o];
    if (!used[o] && square) deck.push(square);
  });
  const cells = Object.fromEntries(
    Object.entries(state.cells).map(([k, c]) => [
      k,
      used[c.by] ? { ...c, by: used[c.by] } : c,
    ]),
  );
  return {
    ...state,
    players: names,
    hands,
    deck,
    cells,
    active: state.active && used[state.active] ? used[state.active] : null,
  };
}

/** The line under the final score. */
export function rating(n: number, total: number): string {
  const r = n / total;
  if (r >= 0.92) return "Almost every link landed. Try the next unit, or Up to three off.";
  if (r >= 0.76) return "Strong board. A couple of clues missed, nothing serious.";
  if (r >= 0.56) return "More than half on the board. Play the same unit again.";
  if (r >= 0.36) return "Some clues got lost. Try Up to three words for the next round.";
  return "A hard board. Try the 4 × 4 size first.";
}
