// Session-scoped store for lessons opened from a local JSON file.
//
// The presenter menu can launch a class straight from a file the teacher picks
// on disk — that lesson exists neither in the build-time glob (@/lib/lessons)
// nor in the cloud, so present/control have nothing to resolve it by. We stash
// it here keyed by id and navigate to /present/:id (or /control/:id); the route
// then reads it back out via @/features/presenter/use-resolved-lesson.
//
// Persisted to sessionStorage (not just memory) so a reload on the display —
// or the display and control being two separate tabs/devices reached by URL —
// still finds the lesson for the length of the session. It is intentionally
// ephemeral: opening a file is a "run this now" action, not a save (that's the
// Studio's "Save to cloud").

import type { Lesson } from "@/lib/lessons";

const STORAGE_PREFIX = "lexicon-local-lesson:";

/** A short, URL-safe id for a lesson whose own `id` is empty. */
function fallbackId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now());
  return `local-${rand}`;
}

/**
 * Stores a locally-opened lesson for this session and returns the id to route
 * with. Uses the lesson's own slug when it has one (so re-opening the same file
 * reuses the same URL), otherwise mints a throwaway `local-*` id.
 */
export function putLocalLesson(lesson: Lesson): string {
  const id = lesson.id?.trim() || fallbackId();
  try {
    sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(lesson));
  } catch {
    // Private mode / quota — the in-memory value below still serves this tab.
  }
  memory.set(id, lesson);
  return id;
}

/** Returns a locally-opened lesson by id, or undefined if none is stored. */
export function getLocalLesson(id: string): Lesson | undefined {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return undefined;
    const lesson = JSON.parse(raw) as Lesson;
    memory.set(id, lesson);
    return lesson;
  } catch {
    return undefined;
  }
}

// In-memory mirror so lookups don't re-parse JSON on every navigation.
const memory = new Map<string, Lesson>();
