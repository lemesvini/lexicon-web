// Realtime contract between the iPad (control) and the Mac (display).
//
// Transport: Supabase Realtime Broadcast on channel `lesson:{lessonId}`.
// Direction is one-way by role — the iPad publishes commands, the Mac
// subscribes and mirrors. Last-write-wins; no conflict resolution because the
// iPad is the only writer (see docs/presenter.md).
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

export const syncPayload = z.object({
  slide: z.number().int().nonnegative(),
  active: z.boolean().default(false),
  elements: z.array(z.unknown()).default([]),
});

export type NavPayload = z.infer<typeof navPayload>;
export type SyncPayload = z.infer<typeof syncPayload>;
export type BoardPayload = z.infer<typeof boardPayload>;

/** UI-level connection state, mapped from Supabase's channel status. */
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Creates (but does not subscribe) the lesson channel. `self: false` so the
 * control never receives echoes of its own broadcasts.
 */
export function lessonChannel(lessonId: string): RealtimeChannel {
  return supabase.channel(`lesson:${lessonId}`, {
    config: { broadcast: { self: false } },
  });
}
