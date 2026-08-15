import * as React from "react";

import type { AnswerValue } from "@/lib/lessons";
import { saveMyAnswers } from "@/lib/student-content";
import type { SaveState } from "./components/exercise-stepper";

/** How long after the last change to write. Long enough that typing a written
 *  answer is one save rather than thirty, short enough that closing the tab a
 *  moment after clicking an option doesn't lose it. */
const DELAY_MS = 800;

/**
 * Writes the student's answers a moment after they stop changing them.
 *
 * Deliberately keyed on `dirty` rather than on a "have I run before?" ref: the
 * effect must not fire for the answers that were just loaded from the server,
 * and "the student has touched something" is the honest way to say that. It also
 * means a homework opened and closed without a single answer writes nothing at
 * all, instead of creating an empty submission row.
 *
 * Nothing here retries. A failed save leaves the indicator showing the failure
 * and the answers still in the component, and the next change tries again —
 * which is what a student would do anyway.
 */
export function useAutosave({
  homeworkId,
  answers,
  dirty,
  enabled,
}: {
  homeworkId: string;
  answers: Record<string, AnswerValue>;
  /** True once the student has changed something this session. */
  dirty: boolean;
  /** False once handed in — there is nothing left to save. */
  enabled: boolean;
}): SaveState {
  const [state, setState] = React.useState<SaveState>("idle");

  React.useEffect(() => {
    if (!enabled || !dirty) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setState("saving");
      saveMyAnswers(homeworkId, answers)
        .then(() => {
          if (!cancelled) setState("saved");
        })
        .catch(() => {
          if (!cancelled) setState("error");
        });
    }, DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [homeworkId, answers, dirty, enabled]);

  return state;
}
