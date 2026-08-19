// The app's navigation, as data.
//
// Lives apart from the components so the sidebar (which renders the links) and
// the header (which types its back arrow against the same set of destinations)
// can't drift out of step.

import {
  ClipboardCheckIcon,
  GraduationCapIcon,
  HandshakeIcon,
  KeyRoundIcon,
  LibraryIcon,
  NotebookPenIcon,
  PaletteIcon,
  PresentationIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/profile";

export type LinkTo =
  | "/lessons"
  | "/studio"
  | "/modules"
  | "/students"
  | "/teachers"
  | "/groups"
  | "/partners"
  | "/finances"
  | "/corrections"
  | "/learn"
  | "/homework"
  | "/change-password";

export type NavLink = { label: string; to: LinkTo; icon: LucideIcon };

/** A run of links under one heading. The heading is left off where there is only
 *  one group — a lone label names nothing the reader can't already see. */
export type NavSection = { label?: string; links: readonly NavLink[] };

// Running a class, in the order the work happens: pick the lesson, write one,
// file it, mark what came back. "/lessons" is the presenter's launcher, so it is
// Lessons here rather than a dashboard — nothing about it is a summary.
const CLASSES: readonly NavLink[] = [
  { label: "Lessons", to: "/lessons", icon: PresentationIcon },
  { label: "Studio", to: "/studio", icon: PaletteIcon },
  { label: "Modules", to: "/modules", icon: LibraryIcon },
  { label: "Corrections", to: "/corrections", icon: ClipboardCheckIcon },
];

// Partners sits here rather than under Admin on the grounds that a partner is a
// commercial relationship — move it if it turns out to be a filing job.
const FINANCE: readonly NavLink[] = [
  { label: "Finances", to: "/finances", icon: WalletIcon },
  { label: "Partners", to: "/partners", icon: HandshakeIcon },
];

// The people, and who they belong to. Teachers is the admin's alone; everything
// else here a teacher sees too, narrowed to their own students.
function administration(role: Role): readonly NavLink[] {
  return [
    { label: "Students", to: "/students", icon: UsersIcon },
    ...(role === "admin"
      ? [{ label: "Teachers", to: "/teachers", icon: UserCogIcon } as const]
      : []),
    { label: "Groups", to: "/groups", icon: UsersRoundIcon },
  ];
}

// A student's whole app is their module, so their menu is that plus the account
// items every user gets — one short list, and nothing to sort it into.
const STUDENT_SECTIONS: readonly NavSection[] = [
  {
    links: [
      { label: "My module", to: "/learn", icon: GraduationCapIcon },
      { label: "Homework", to: "/homework", icon: NotebookPenIcon },
      { label: "Change password", to: "/change-password", icon: KeyRoundIcon },
    ],
  },
];

/** The pages this role can reach, grouped as the sidebar lists them. */
export function sectionsFor(role: Role | undefined): readonly NavSection[] {
  if (role !== "admin" && role !== "teacher") return STUDENT_SECTIONS;

  return [
    { label: "Classes", links: CLASSES },
    { label: "Finance", links: FINANCE },
    { label: "Admin", links: administration(role) },
  ];
}
