import * as React from "react";

/**
 * Best score per reading, kept in the browser.
 *
 * Practice is the student's own — nobody marks it, nothing is handed in — so
 * there is no row for it yet, and a score that lives in localStorage is enough
 * for the list to say which texts are done. If the scores ever need to follow
 * a student between devices, this is the one file to swap.
 */

const KEY = "lexicon:practice:scores";

export type Score = { correct: number; total: number };

type Scores = Record<string, Score>;

function read(): Scores {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Scores) : {};
  } catch {
    return {};
  }
}

function write(scores: Scores) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scores));
  } catch {
    // A private window or a full disk: the score still shows for this session.
  }
}

export function usePracticeScores() {
  const [scores, setScores] = React.useState<Scores>(read);

  // Keeps the best attempt: a student who got 5/5 and then retries for fun
  // should not see the list drop back to 3/5.
  const record = React.useCallback((id: string, score: Score) => {
    setScores((prev) => {
      const best = prev[id];
      if (best && best.correct >= score.correct) return prev;
      const next = { ...prev, [id]: score };
      write(next);
      return next;
    });
  }, []);

  return { scores, record };
}
