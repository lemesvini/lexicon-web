// Stable identity for a block, minted once when the block is created and never
// changed afterwards.
//
// Unlike the editor keys in @/features/studio/model, this one is part of the
// document and survives a save. It has to: a submission is a map from block id
// to answer, so an id that changed between edits would orphan every answer
// already given (see supabase/migrations/0005_homework_exercises.sql).

/** A fresh block id. */
export function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
