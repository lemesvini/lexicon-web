// Draft or published — the single bit that decides whether a student sees an
// artifact at all.
//
// Shared by materials and homework because they are published independently: of
// each other, and of the presentation they hang off. A lesson can be finished
// and projected in class while its student material is still being written.

export type PublishStatus = "draft" | "published";

/**
 * Coerces the raw `status` column. Anything unrecognized reads as a draft —
 * failing towards "the student doesn't see it" is the only safe direction here.
 */
export function toPublishStatus(raw: unknown): PublishStatus {
  return raw === "published" ? "published" : "draft";
}
