import * as React from "react";
import {
  ClipboardListIcon,
  FileTextIcon,
  GraduationCapIcon,
  NotebookPenIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPercent } from "@/features/students/components/student-formats";
import type {
  StudentDossier,
  StudentSummary,
} from "@/features/students/data/student-profile";

/** Which listing the rail is showing. Also the key each openable tile is
 *  identified by, so "is this one open?" is one comparison. */
export type RailKey =
  | "homework"
  | "attendance"
  | "groups"
  | "modules"
  | "context"
  | "reports";

/**
 * The shell every tile shares: the border, the padding, and — where the tile
 * opens something — the button semantics and the lit state that says which
 * listing the rail is currently showing.
 *
 * Rendered as a `<button>` only when it does something. A div with an onClick
 * is not reachable by keyboard, and a button that does nothing announces
 * itself to a screen reader as an action that isn't there.
 */
export function Tile({
  /** Where this tile sits in the gallery — its column and row span. */
  span,
  active,
  onClick,
  className,
  children,
}: {
  span: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const shell = cn(
        "flex h-full min-h-0 flex-col rounded-2xl border bg-card p-3 text-left text-card-foreground transition-colors sm:p-4 lg:p-5",
    onClick && "hover:border-primary/40 hover:bg-accent/40",
    active && "border-primary/50 bg-accent/30 ring-2 ring-primary/25",
    span,
    className,
  );

  if (!onClick) return <div className={shell}>{children}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        shell,
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}

/**
 * One figure: a label, the number, and one line saying what it is out of.
 *
 * The caption is not optional by accident. A bare "82%" invites the reader to
 * supply their own denominator, and on this page every one of these is out of
 * something the school only partly knows — marks out of the homework corrected,
 * attendance out of the registers actually taken.
 *
 * `justify-between` rather than a stack: these tiles are stretched to whatever
 * height their grid row settles at, and a figure that floats mid-tile reads as
 * a mistake where one pinned to the bottom reads as a baseline.
 */
export function StatTile({
  label,
  value,
  caption,
  /** Dims the value where there is nothing yet, so an empty stat doesn't read
   *  with the same weight as a real one. */
  muted = false,
  span,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  muted?: boolean;
  span: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tile span={span} active={active} onClick={onClick} className="justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            muted && "text-muted-foreground",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
    </Tile>
  );
}

/**
 * A category: an icon, a name, and a sentence saying where the student stands
 * in it — never the listing itself. The listing is what the rail is for; a
 * tile that carries both is neither a quick glance nor a full one.
 */
export function CategoryTile({
  icon: Icon,
  title,
  description,
  span,
  active,
  onClick,
}: {
  icon: typeof ClipboardListIcon;
  title: string;
  description: string;
  span: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tile span={span} active={active} onClick={onClick} className="gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
      </div>
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {description}
      </p>
    </Tile>
  );
}

/** The icon each category is drawn with, kept beside the sentences below so
 *  the two never drift apart. */
export const CATEGORY_ICON: Record<
  Exclude<RailKey, "attendance">,
  typeof ClipboardListIcon
> = {
  homework: ClipboardListIcon,
  groups: UsersIcon,
  modules: GraduationCapIcon,
  context: NotebookPenIcon,
  reports: FileTextIcon,
};

/**
 * What each category tile says about this student — one sentence apiece,
 * written from the same dossier the rail's listings are drawn from.
 *
 * Returned as data rather than markup so the gallery decides where each one
 * lands and how wide it is; this only decides what it says.
 */
export function describeCategories(
  dossier: StudentDossier,
  summary: StudentSummary,
): Record<Exclude<RailKey, "attendance">, string> {
  const handedIn = summary.gradedCount + summary.awaitingCount;

  const homework =
    summary.totalSubmissions === 0
      ? "Nothing set yet — publish a homework against a lesson in their module."
      : `${handedIn} out of ${summary.totalSubmissions} homework${
          summary.totalSubmissions === 1 ? "" : "s"
        } submitted, attendance at ${formatPercent(summary.attendanceRate)}.`;

  const groups =
    dossier.groups.length === 0
      ? "Not in a group yet, so there is nobody to take a register with."
      : `In ${dossier.groups.length} group${
          dossier.groups.length === 1 ? "" : "s"
        }: ${dossier.groups.map((group) => group.name || "Unnamed").join(", ")}.`;

  const completed = dossier.modules.filter(
    (entry) => entry.status === "completed",
  ).length;
  const current = dossier.modules.find((entry) => entry.status === "in_progress");
  const modules =
    dossier.modules.length === 0
      ? "Nothing recorded yet. Placing them in a module starts their history."
      : `${completed} completed of ${dossier.modules.length}${
          current ? `, currently in ${current.module || "an unnamed module"}` : ""
        }.`;

  // The note itself, clipped — a summary of a free-text field would be a guess,
  // and the first line of what someone actually wrote is the better preview.
  const note = dossier.student.notes.trim();
  const context = note
    ? note.length > 140
      ? `${note.slice(0, 140).trimEnd()}…`
      : note
    : "Nothing on file yet — what's worth remembering about them?";

  // Deliberately not counted from anything: the reports live in their own table
  // and the dossier doesn't carry them, so this says what the tile is for rather
  // than pretending to know how many there are.
  const reports =
    "What happened each unit, and how the test went — the record next term is planned from.";

  return { homework, groups, modules, context, reports };
}
