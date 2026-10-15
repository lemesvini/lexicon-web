// Who Am I: each guest has a character on their forehead that everyone can see
// but them. They ask yes/no questions, and every answer becomes a hint on their
// sheet until they guess who they are.

export const MAX_GUESTS = 4;

export type Guest = {
  id: string;
  /** The student's own name, on the chest nametag. */
  player: string;
  /** Who they are playing. Hidden on the plate until revealed. */
  character: string;
  revealed: boolean;
  hints: string[];
};

export type WhoAmIState = { guests: Guest[] };

export function newGuest(): Guest {
  return {
    id: Math.random().toString(36).slice(2, 9),
    player: "",
    character: "",
    revealed: false,
    hints: [],
  };
}

export function freshWhoAmI(): WhoAmIState {
  return { guests: [newGuest(), newGuest()] };
}

/** A stored round, if it still looks like one. */
export function parseWhoAmI(raw: unknown): WhoAmIState | null {
  const s = raw as WhoAmIState | null;
  return s && Array.isArray(s.guests) && s.guests.length ? s : null;
}

/** The same round with one guest changed. */
export function withGuest(
  state: WhoAmIState,
  id: string,
  change: (g: Guest) => Guest,
): WhoAmIState {
  return {
    guests: state.guests.map((g) => (g.id === id ? change(g) : g)),
  };
}

/** Every named character is showing. Drives "Reveal all" / "Hide all". */
export function allRevealed(state: WhoAmIState): boolean {
  return state.guests.every((g) => !g.character || g.revealed);
}
