// Two Truths, One Lie: each player says three things about themselves, and the
// class points at the one they think is the lie. The player says whether the
// class was right; when it wasn't, the real lie is shown.

export const MAX_GUESTS = 4;

export type Verdict = "right" | "wrong";

export type Guest = {
  id: string;
  /** The student's own name, on the chest nametag. */
  player: string;
  statements: [string, string, string];
  /** The statement the class pointed at, by index. */
  guess: number | null;
  /** Whether the class caught the lie. Null until the player says. */
  result: Verdict | null;
  /** The real lie, once known: the guess when right, picked by hand when not. */
  lie: number | null;
};

export type TwoTruthsState = { guests: Guest[] };

export function newGuest(): Guest {
  return {
    id: Math.random().toString(36).slice(2, 9),
    player: "",
    statements: ["", "", ""],
    guess: null,
    result: null,
    lie: null,
  };
}

export function freshTwoTruths(): TwoTruthsState {
  return { guests: [newGuest(), newGuest()] };
}

/** A stored round, if it still looks like one. */
export function parseTwoTruths(raw: unknown): TwoTruthsState | null {
  const s = raw as TwoTruthsState | null;
  return s && Array.isArray(s.guests) && s.guests.length ? s : null;
}

/** The same round with one guest changed. */
export function withGuest(
  state: TwoTruthsState,
  id: string,
  change: (g: Guest) => Guest,
): TwoTruthsState {
  return {
    guests: state.guests.map((g) => (g.id === id ? change(g) : g)),
  };
}

/** All three statements written — the class can start guessing. */
export function filled(g: Guest): boolean {
  return g.statements.every((s) => s.trim());
}

/** The guess and verdict wiped, statements kept. */
export function cleared(g: Guest): Guest {
  return { ...g, guess: null, result: null, lie: null };
}

/**
 * What a click on statement `k` does, given where the guest's turn is.
 *
 * Before the verdict it moves the class's guess (and clicking the guess again
 * takes it back). After a "wrong" it marks the real lie. After a "right" there
 * is nothing left to pick. Returns null when the click changes nothing, and says
 * whether the change is worth an Undo step: moving the guess around while the
 * class argues is not; marking the lie is.
 */
export function pick(
  g: Guest,
  k: number,
): { next: Guest; undoable: boolean } | null {
  if (g.result === "right") return null;
  if (g.result === "wrong") {
    if (k === g.guess) return null;
    return { next: { ...g, lie: g.lie === k ? null : k }, undoable: true };
  }
  return {
    next: { ...g, guess: g.guess === k ? null : k },
    undoable: false,
  };
}
