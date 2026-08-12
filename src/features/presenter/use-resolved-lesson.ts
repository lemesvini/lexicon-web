import { useEffect, useState } from "react";
import { getLesson, type Lesson } from "@/lib/lessons";
import { getLocalLesson } from "@/lib/lesson-store";
import { fetchCloudLesson } from "@/lib/lessons-cloud";

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
 */
export function useResolvedLesson(id: string): ResolvedLesson {
  // Synchronous sources are stable per id (both come from module-level Maps),
  // so this reference is safe to use as an effect dependency.
  const local = getLesson(id) ?? getLocalLesson(id);

  const [state, setState] = useState<State>(() => ({
    id,
    lesson: local,
    loading: !local,
  }));

  // Adjusting state during render when the id changes is React's endorsed
  // alternative to a reset-in-effect (which the lint rules forbid): it resets
  // to the loading state for the new id before the async effect below runs.
  if (state.id !== id) {
    setState({ id, lesson: local, loading: !local });
  }

  useEffect(() => {
    if (local) return;
    let cancelled = false;
    fetchCloudLesson(id)
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
  }, [id, local]);

  return { lesson: state.lesson, loading: state.loading };
}
