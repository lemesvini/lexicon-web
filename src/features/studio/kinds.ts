// The three things the Studio authors.
//
// All three are the same document underneath — meta plus a `slides` array of
// blocks (see @/lib/lessons) — which is what lets one editor serve all three and
// what makes "seed the material from the presentation" a copy rather than a
// conversion. What differs is who reads it, and that is what this file names.

import {
  MonitorPlayIcon,
  NotebookPenIcon,
  BookOpenIcon,
  type LucideIcon,
} from "lucide-react";

export type StudioKind = "lesson" | "material" | "homework";

/**
 * The id standing in for "one that doesn't exist yet", as in
 * `/studio/lesson/new`.
 *
 * A reserved param rather than a `/new` route of its own, so that saving a new
 * document moves from `new` to its real slug as a param change on the same
 * route — no remount, and no re-fetch of the document just written. The cost is
 * that nothing can be slugged "new"; the editors refuse it on save.
 */
export const NEW_DOCUMENT_ID = "new";

export type StudioKindMeta = {
  kind: StudioKind;
  /** Plural — the library tab. */
  label: string;
  /** Singular — the create dialog and the editor's chrome. */
  singular: string;
  /** One line, in the create dialog. */
  hint: string;
  icon: LucideIcon;
};

export const STUDIO_KINDS: readonly StudioKindMeta[] = [
  {
    kind: "lesson",
    label: "Presentations",
    singular: "Presentation",
    hint: "The deck you project and drive in class, teacher notes included.",
    icon: MonitorPlayIcon,
  },
  {
    kind: "material",
    label: "Student material",
    singular: "Student material",
    hint: "The student's copy of a lesson — read on their own device, on their own time.",
    icon: BookOpenIcon,
  },
  {
    kind: "homework",
    label: "Homework",
    singular: "Homework",
    hint: "Exercises to attach to a lesson, now or later.",
    icon: NotebookPenIcon,
  },
];

export function studioKind(kind: StudioKind): StudioKindMeta {
  // Non-null: STUDIO_KINDS covers the union, and the union is closed.
  return STUDIO_KINDS.find((k) => k.kind === kind)!;
}
