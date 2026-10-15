import { useCallback, useEffect, useState } from "react";
import { storageKey, useMinigameSync } from "./sync";

/** How many steps Undo remembers. Past that, the oldest is dropped. */
const HISTORY = 60;

function readStored<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * A game's round, kept in this browser between visits, with an Undo stack —
 * and, inside a presentation, shared with the other device.
 *
 * A teacher who reloads mid-round should find the round where they left it, so
 * every round is stored per browser under its scope (see `storageKey`). Every
 * storage call is allowed to fail; the game then carries on from `fresh()`.
 *
 * Inside a presentation (a `MinigameSync` in context) each commit is also sent
 * to the other device, and theirs arrive here. Both devices keep their own Undo
 * stack, kept in step by the message's mode: a "push" from the other side is a
 * step here too, so Undo on either device takes back the last change whoever
 * made it, and the Undo itself travels as "undo".
 *
 * States are treated as immutable: `commit` takes the next state as a value, and
 * the previous one is kept by reference for Undo. A commit made with
 * `undoable: false` (revealing a name, switching the clue rule) replaces the
 * present without adding a step, matching what the original games did.
 */
export function useGameState<T>(
  game: string,
  scope: string | undefined,
  parse: (raw: unknown) => T | null,
  fresh: () => T,
) {
  const sync = useMinigameSync();
  const key = storageKey(game, sync?.scope ?? scope);

  const [round, setRound] = useState(() => {
    const live = sync?.read(game);
    return {
      state:
        (live === undefined ? null : parse(live)) ??
        readStored(key, parse) ??
        fresh(),
      past: [] as T[],
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(round.state));
    } catch {
      // Private window or blocked storage: the round just won't survive a reload.
    }
  }, [key, round.state]);

  // The round this device opened on, offered for the catch-up of a device that
  // joins after it. A no-op once the session knows a round for this game.
  useEffect(() => {
    sync?.seed(game, round.state);
  }, [sync, game, round.state]);

  // The other device's changes.
  useEffect(() => {
    if (!sync) return;
    return sync.listen(game, ({ state, mode }) => {
      const next = parse(state);
      if (!next) return;
      setRound((r) => ({
        state: next,
        past:
          mode === "push"
            ? [...r.past.slice(-(HISTORY - 1)), r.state]
            : mode === "undo"
              ? r.past.slice(0, -1)
              : r.past,
      }));
    });
  }, [sync, game, parse]);

  const commit = useCallback(
    (next: T, { undoable = true }: { undoable?: boolean } = {}) => {
      setRound((r) => ({
        state: next,
        past: undoable ? [...r.past.slice(-(HISTORY - 1)), r.state] : r.past,
      }));
      sync?.publish({ game, state: next, mode: undoable ? "push" : "replace" });
    },
    [sync, game],
  );

  /** Steps back once. Returns the restored state so the caller can adjust
   *  anything derived from it; `null` when there was nothing to undo. */
  const undo = useCallback(() => {
    const previous = round.past.at(-1);
    if (previous === undefined) return null;
    setRound({ state: previous, past: round.past.slice(0, -1) });
    sync?.publish({ game, state: previous, mode: "undo" });
    return previous;
  }, [round.past, sync, game]);

  return {
    state: round.state,
    commit,
    undo,
    canUndo: round.past.length > 0,
  };
}
