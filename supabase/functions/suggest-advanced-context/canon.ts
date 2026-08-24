// The two pieces of curriculum knowledge the suggestion agent needs, and the one
// file you edit to give them to it.
//
// Neither of these can be derived from the database. `lessons` holds documents,
// not a curriculum: nothing in it says who Alex is or which structure is safe to
// use by lesson 13. Both are editorial decisions that live in someone's head, so
// they live here, in prose, rather than being inferred from content and getting it
// subtly wrong.
//
// WHERE THEY GO IN THE PROMPT, and why it matters:
//
//   ALEX_CANON       → inside STATIC_RULES, the FIRST cached block. Never changes
//                      between calls, so it rides the cheapest cache prefix.
//   BOOK_ONE_GRAMMAR → inside the book overview, the SECOND cached block, plus
//                      one uncached per-lesson line naming what THIS lesson has
//                      unlocked (see `lessonNote` in index.ts).
//
// Editing either one invalidates the cache from that block onward — which is
// correct, and is why they are separated from the class dossier that changes on a
// different cadence.

/**
 * Who Alex is.
 *
 * Alex is the recurring character the course's dialogues are built around, and
 * the agent writes new dialogue for them. Without a canon it invents a different
 * Alex every call — a different job, a different city, a different register — and
 * a class that has met Alex nine times notices immediately.
 *
 * What belongs here: name, age bracket, where they live and work, how they speak
 * (formal/casual, any verbal tics), who else recurs around them, and anything the
 * course has already established as fact that a new dialogue must not contradict.
 *
 * TODO(vinicius): replace this placeholder with the real canon.
 */
export const ALEX_CANON = `(No character canon has been provided yet. Do not
invent biographical facts about Alex — keep any dialogue with Alex generic, and
prefer blocks that do not depend on who Alex is.)`;

/**
 * What structure each lesson of Book One unlocks.
 *
 * The agent's suggestions have to be answerable by the class as they are *now*.
 * A dialogue in the present perfect handed to a class on lesson 6 is not a
 * stretch, it is unusable — and nothing downstream would catch it, because the
 * blocks are structurally valid either way.
 *
 * What belongs here: one line per lesson, in order, naming the structure it
 * introduces. The agent is told to use only what is unlocked at or before the
 * lesson it is suggesting for, so the ordering is the whole contract.
 *
 * Example of the shape expected:
 *
 *   B1L1  Present Simple — to be
 *   B1L2  Present Simple — do/does, negatives and questions
 *   …
 *   B1L9  Past Simple — regular verbs
 *
 * TODO(vinicius): replace this placeholder with the real progression.
 */
export const BOOK_ONE_GRAMMAR = `(No grammar progression has been provided yet.
Judge the level from the lesson's own \`grammarFocus\` and from the language
already present in its slides, and stay at or below it.)`;

/**
 * Whether the two constants above are real yet.
 *
 * Used to decide whether to emit the per-lesson grammar note at all: a note built
 * from a placeholder would be worse than no note, because it reads to the model as
 * a real constraint that happens to say nothing.
 */
export const CANON_PROVIDED = false;
