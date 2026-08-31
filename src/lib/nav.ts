// The app's navigation, as data.
//
// Lives apart from the components so the sidebar (which renders the links) and
// the header (which types its back arrow against the same set of destinations)
// can't drift out of step.

import {
  CalendarDaysIcon,
  ClipboardCheckIcon,
  DumbbellIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HouseIcon,
  KeyRoundIcon,
  LibraryIcon,
  NotebookPenIcon,
  PaletteIcon,
  PresentationIcon,
  SparklesIcon,
  UserRoundIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/profile";

export type LinkTo =
  | "/lessons"
  | "/schedule"
  | "/studio"
  | "/modules"
  | "/students"
  | "/teachers"
  | "/groups"
  | "/partners"
  | "/finances"
  | "/corrections"
  | "/learn"
  | "/my-lessons"
  | "/my-homework"
  | "/my-context"
  | "/practice"
  | "/profile"
  | "/change-password";

export type NavLink = { label: string; to: LinkTo; icon: LucideIcon };

/** A run of links under one heading. The heading is left off where there is only
 *  one group — a lone label names nothing the reader can't already see. */
export type NavSection = { label?: string; links: readonly NavLink[] };

// Running a class, in the order the work happens: see when it is, pick the
// lesson, write one, file it, mark what came back. "/lessons" is the presenter's launcher, so it is
// Lessons here rather than a dashboard — nothing about it is a summary.
// Studio and Modules are the admin's: both edit the library the whole school
// shares. A teacher shapes a lesson for their own group through the advanced
// context editor instead, reached from the group rather than from here.
function classes(role: Role): readonly NavLink[] {
  return [
    { label: "Lessons", to: "/lessons", icon: PresentationIcon },
    { label: "Schedule", to: "/schedule", icon: CalendarDaysIcon },
    ...(role === "admin"
      ? ([
          { label: "Studio", to: "/studio", icon: PaletteIcon },
          { label: "Modules", to: "/modules", icon: LibraryIcon },
        ] as const)
      : []),
    { label: "Corrections", to: "/corrections", icon: ClipboardCheckIcon },
  ];
}

// Partners sits here rather than under Admin on the grounds that a partner is a
// commercial relationship — move it if it turns out to be a filing job. It is
// the school's own book of contracts, so like Studio it stays with the admin.
function finance(role: Role): readonly NavLink[] {
  return [
    { label: "Finances", to: "/finances", icon: WalletIcon },
    ...(role === "admin"
      ? [{ label: "Partners", to: "/partners", icon: HandshakeIcon } as const]
      : []),
  ];
}

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

// The student's app is four places plus the account items every user gets. The
// home screen shows the same four as cards; the sidebar lists them so a student
// two pages in doesn't have to go back through it to move sideways.
const STUDENT_SECTIONS: readonly NavSection[] = [
  {
    links: [
      { label: "Home", to: "/learn", icon: HouseIcon },
      { label: "My lessons", to: "/my-lessons", icon: GraduationCapIcon },
      { label: "My homework", to: "/my-homework", icon: NotebookPenIcon },
      { label: "My context", to: "/my-context", icon: SparklesIcon },
      { label: "Practice", to: "/practice", icon: DumbbellIcon },
      { label: "My profile", to: "/profile", icon: UserRoundIcon },
      { label: "Change password", to: "/change-password", icon: KeyRoundIcon },
    ],
  },
];

/** The pages this role can reach, grouped as the sidebar lists them. */
export function sectionsFor(role: Role | undefined): readonly NavSection[] {
  if (role !== "admin" && role !== "teacher") return STUDENT_SECTIONS;

  return [
    { label: "Classes", links: classes(role) },
    { label: "Finance", links: finance(role) },
    { label: "Admin", links: administration(role) },
  ];
}
