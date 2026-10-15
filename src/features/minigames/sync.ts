import { createContext, useContext } from "react";

// How a minigame on a presented slide is played from two devices at once.
//
// The display (projector) and the control (iPad) each run the game, and each
// change made on one is sent to the other over the presentation's channel, so
// the room and the teacher are always looking at the same round. The teacher
// can play from the iPad — typing a Who Am I character where the room can't see
// it, dealing Crossings squares — and anyone at the projector can still click.
//
// This module knows nothing about Supabase: the presenter hooks own the channel
// and `attach` a `send` function while it is open, call `receive` with what arrives,
// and use `snapshot` / `adopt` for the catch-up when one side (re)joins.
// Everything outside a presentation — the /minigames page, the studio's
// previews — has no sync in context and plays a round of its own.

export type GameMode = "push" | "replace" | "undo";
export type GameMessage = { game: string; state: unknown; mode: GameMode };
type Listener = (message: GameMessage) => void;

export class MinigameSync {
  /** The latest round of every game seen this session, for the catch-up. */
  private rounds = new Map<string, unknown>();
  private listeners = new Map<string, Set<Listener>>();
  private send: ((message: GameMessage) => void) | null = null;
  /** Where the rounds are kept in this browser — the presentation key, so a
   *  reload of either device comes back to the same round, and the same game in
   *  another group's lesson is a different one. */
  readonly scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  /** Connects the channel. Returns the disconnect. A change made while nothing
   *  is attached is still kept, and goes out with the next catch-up. */
  attach(send: (message: GameMessage) => void): () => void {
    this.send = send;
    return () => {
      if (this.send === send) this.send = null;
    };
  }

  /** The round to start from, if this session already has one in memory. */
  read(game: string): unknown {
    return this.rounds.get(game);
  }

  /** The round a game opened on here, so a device that joins later is handed
   *  it. Never overrides one this session already knows. */
  seed(game: string, state: unknown): void {
    if (!this.rounds.has(game)) this.rounds.set(game, state);
  }

  /** A change made here: remember it and tell the other device. */
  publish(message: GameMessage): void {
    this.rounds.set(message.game, message.state);
    this.send?.(message);
  }

  /**
   * A change made on the other device. Kept even when no game is mounted to
   * hear it (the teacher may be on another slide) — and written to this
   * browser's storage for the same reason, so the game opens on it later.
   */
  receive(message: GameMessage): void {
    this.rounds.set(message.game, message.state);
    try {
      localStorage.setItem(
        storageKey(message.game, this.scope),
        JSON.stringify(message.state),
      );
    } catch {
      // Blocked storage: the round still reaches a mounted game.
    }
    this.listeners.get(message.game)?.forEach((fn) => fn(message));
  }

  /** Listens for the other device's changes to one game. */
  listen(game: string, fn: Listener): () => void {
    let set = this.listeners.get(game);
    if (!set) this.listeners.set(game, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  /** Every round this device knows, for a device that just joined. */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.rounds);
  }

  /** Takes on the rounds the other device sent on joining. */
  adopt(games: Record<string, unknown>): void {
    for (const [game, state] of Object.entries(games))
      this.receive({ game, state, mode: "replace" });
  }
}

/**
 * Where a game's round is kept in this browser.
 *
 * `scope` is the presentation key inside a presentation (see `MinigameSync`),
 * "preview" in the studio's slide previews, and absent on the /minigames page —
 * each a round of its own.
 */
export function storageKey(game: string, scope?: string): string {
  return `lexicon-minigame:${game}${scope ? `:${scope}` : ""}`;
}

export const MinigameSyncContext = createContext<MinigameSync | null>(null);

/** The presentation this game is being played in, if any. */
export function useMinigameSync(): MinigameSync | null {
  return useContext(MinigameSyncContext);
}
