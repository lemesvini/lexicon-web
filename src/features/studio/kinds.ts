// The things the Studio edits.
//
// All of them are the same document underneath — meta plus a `slides` array of
// blocks (see @/lib/lessons) — which is what lets one editor serve them all and
// what makes "seed the material from the presentation" a copy rather than a
// conversion. What differs is who reads it, and that is what this file names.

import {
  MonitorPlayIcon,
  NotebookPenIcon,
  BookOpenIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

export type StudioKind = "lesson" | "material" | "homework" | "advanced";

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

/** The kinds you can start from the Studio's Create button. */
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

/**
 * A group's own copy of a lesson — the fourth kind, and the one you can't create
 * from here.
 *
 * It is deliberately outside `STUDIO_KINDS`: a copy exists because a group was
 * given a module (see the group's Lessons tab), not because somebody pressed
 * Create. Listing it in the "what are you making?" dialog would offer a choice
 * that has no answer at that point — there is no group to make it for.
 */
export const ADVANCED_KIND: StudioKindMeta = {
  kind: "advanced",
  label: "Advanced context",
  singular: "Advanced context",
  hint: "One group's copy of a lesson, with the blocks that are only for them.",
  icon: SparklesIcon,
};

export function studioKind(kind: StudioKind): StudioKindMeta {
  // Non-null: these two together cover the union, and the union is closed.
  return (
    STUDIO_KINDS.find((k) => k.kind === kind) ??
    (kind === "advanced" ? ADVANCED_KIND : STUDIO_KINDS[0])
  );
}
