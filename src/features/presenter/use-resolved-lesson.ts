import { useEffect, useState } from "react";
import { getLesson, type Lesson } from "@/lib/lessons";
import { getLocalLesson } from "@/lib/lesson-store";
import { fetchCloudLesson } from "@/lib/lessons-cloud";
import { fetchGroupLesson } from "@/features/groups/data/group-lessons";

export type ResolvedLesson = {
  lesson: Lesson | undefined;
  /** True until resolution settles. Present/control show a spinner meanwhile. */
  loading: boolean;
};

type State = { id: string; lesson: Lesson | undefined; loading: boolean };

/**
 * Resolves a lesson id from any of the three sources present/control can run,
 * in cheapest-first order:
 *   1. the build-time glob (`src/situations/*.json`, bundled into the app),
 *   2. a lesson opened from a local file this session (@/lib/lesson-store),
 *   3. the Supabase cloud library (async).
 *
 * The first two are synchronous, so a bundled or just-opened lesson paints
 * immediately with no loading flash; only a cloud-only id hits the network.
 *
 * `groupId` overrides all three. Presenting *for a group* means presenting that
 * group's own copy — the shared lesson plus whatever advanced context was added
 * for this class (migration 0010). It is always a fetch, so the synchronous
 * shortcut is deliberately skipped: painting the shared lesson first and swapping
 * in the group's copy a moment later would flash the wrong deck onto a projector.
 * A group with no copy of this lesson falls back to the shared one.
 */
export function useResolvedLesson(id: string, groupId?: string): ResolvedLesson {
  // Synchronous sources are stable per id (both come from module-level Maps),
  // so this reference is safe to use as an effect dependency.
  const local = getLesson(id) ?? getLocalLesson(id);

  // With a group, nothing is resolved synchronously — see above.
  const immediate = groupId ? undefined : local;

  const [state, setState] = useState<State>(() => ({
    id,
    lesson: immediate,
    loading: !immediate,
  }));

  // Adjusting state during render when the id changes is React's endorsed
  // alternative to a reset-in-effect (which the lint rules forbid): it resets
  // to the loading state for the new id before the async effect below runs.
  if (state.id !== id) {
    setState({ id, lesson: immediate, loading: !immediate });
  }

  useEffect(() => {
    if (immediate) return;
    let cancelled = false;

    const resolve = async (): Promise<Lesson | undefined> => {
      if (groupId) {
        const copy = await fetchGroupLesson(groupId, id);
        if (copy) return copy.document;
      }
      return local ?? (await fetchCloudLesson(id));
    };

    resolve()
      .then((lesson) => {
        if (!cancelled) {
          setState((s) => (s.id === id ? { id, lesson, loading: false } : s));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) =>
            s.id === id ? { id, lesson: undefined, loading: false } : s,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, groupId, local, immediate]);

  return { lesson: state.lesson, loading: state.loading };
}
