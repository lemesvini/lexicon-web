// Realtime contract between the iPad (control) and the Mac (display).
//
// Transport: Supabase Realtime Broadcast, one channel per lesson *being
// presented* — see `presentationKey`. Navigation and the whiteboard are one-way
// by role: the iPad publishes, the Mac mirrors, last write wins.
//
// Minigames are the exception: a game on a slide is played from both devices,
// so `game` travels both ways (see @/features/minigames/sync). Two people
// pressing at the same instant is a classroom, not a database — last write wins
// there too.
//
// Zod validates every inbound payload — a malformed broadcast is dropped, never
// trusted. Excalidraw elements are validated only as "an array" (their full
// schema is large and owned by Excalidraw); we hand them straight back to
// updateScene() on the display.

import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const EVENTS = {
  /** control -> display: show this slide index. */
  nav: "nav",
  /** display -> control: I just (re)joined, send me the full state. */
  syncRequest: "sync-request",
  /** control -> display: full current state (slide + board) for a late joiner. */
  sync: "sync",
  /** control -> display: live whiteboard update (throttled). */
  board: "board",
  /** control -> display: I just (re)joined, tell me where the lesson is. */
  stateRequest: "state-request",
  /** display -> control: the slide on screen and the games' rounds. */
  state: "state",
  /** either way: a minigame's round changed on this device. */
  game: "game",
} as const;

export const navPayload = z.object({
  slide: z.number().int().nonnegative(),
});

// Whiteboard state mirrored to the display. `active` drives the drop-down white
// panel; only the currently-open board's elements travel (the display shows one
// board at a time — the control owns the full set of boards).
export const boardPayload = z.object({
  active: z.boolean(),
  elements: z.array(z.unknown()).default([]),
});

/** Every minigame's round, by game id. Each game validates its own state when
 *  it reads it (`parse` in its model), so here it is only "an object". */
const gamesPayload = z.record(z.string(), z.unknown()).default({});

export const syncPayload = z.object({
  slide: z.number().int().nonnegative(),
  active: z.boolean().default(false),
  elements: z.array(z.unknown()).default([]),
  games: gamesPayload,
});

export const statePayload = z.object({
  slide: z.number().int().nonnegative(),
  games: gamesPayload,
});

/**
 * One change to one game's round. `mode` keeps the two devices' Undo stacks in
 * step: "push" is a step Undo can take back, "replace" is not (moving the
 * class's guess around), and "undo" is a step being taken back.
 */
export const gamePayload = z.object({
  game: z.string(),
  state: z.unknown(),
  mode: z.enum(["push", "replace", "undo"]),
});

export type NavPayload = z.infer<typeof navPayload>;
export type SyncPayload = z.infer<typeof syncPayload>;
export type BoardPayload = z.infer<typeof boardPayload>;
export type StatePayload = z.infer<typeof statePayload>;
export type GamePayload = z.infer<typeof gamePayload>;

/** UI-level connection state, mapped from Supabase's channel status. */
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Which presentation a display and a control meet in.
 *
 * Not the lesson alone: the same lesson is taught to several groups, by several
 * teachers, often at the same hour, and a channel per lesson would put every one
 * of those projectors under every one of those iPads. So a lesson presented for
 * a group is that group's (open the group on the iPad, pick the lesson, and you
 * are driving that room); a lesson presented outside any group is that
 * teacher's. Null until the signed-in user is known, for the second case.
 *
 * Also the scope the session's minigame rounds are stored under.
 */
export function presentationKey(
  lessonId: string,
  groupId: string | undefined,
  userId: string | undefined,
): string | null {
  if (groupId) return `group:${groupId}:${lessonId}`;
  return userId ? `user:${userId}:${lessonId}` : null;
}

/**
 * Creates (but does not subscribe) a presentation's channel. `self: false` so
 * neither side receives echoes of its own broadcasts.
 */
export function lessonChannel(key: string): RealtimeChannel {
  return supabase.channel(`present:${key}`, {
    config: { broadcast: { self: false } },
  });
}
