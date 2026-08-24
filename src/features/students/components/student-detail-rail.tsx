import * as React from "react";

import { cn } from "@/lib/utils";
import { StudentHomeworkPanel } from "@/features/students/components/student-homework-panel";
import { StudentNotesCard } from "@/features/students/components/student-notes-card";
import { StudentUnitReportsCard } from "@/features/students/components/student-unit-reports-card";
import {
  StudentAttendancePanel,
  StudentGroupsPanel,
  StudentModulesPanel,
} from "@/features/students/components/student-side-panels";
import type { RailKey } from "@/features/students/components/student-tiles";
import {
  summarise,
  type StudentDossier,
} from "@/features/students/data/student-profile";

/**
 * The rail's width, at the two sizes it is drawn.
 *
 * Spelled out as whole classes rather than interpolated, because Tailwind only
 * ships classes it can see in the source — and repeated on the page's padding
 * so the two always agree. They are the same measurement: the space the rail
 * takes is exactly the space the page gives up.
 */
export const RAIL_WIDTH = "lg:w-[26rem] xl:w-[30rem]";
export const RAIL_PADDING = "lg:pr-[26rem] xl:pr-[30rem]";

/** Matches the nav sidebar's slide, so the two panels in this app move alike. */
export const RAIL_MS = 220;

/**
 * The listing behind whichever tile is open: a full-height column down the
 * right edge of the screen.
 *
 * Pushes the page rather than covering it. The gallery it belongs to is a grid
 * of tiles that reflows happily into whatever width it is left with, so there
 * is no reason to take the page away from the reader to show them one of its
 * lists — and every reason not to, since the tile they clicked is the context
 * for what they are now reading. Below `lg` there is no width to give up, so
 * it overlays and brings a scrim to dismiss itself with.
 *
 * Held open by the page, not by itself: the tile that opened it is the thing
 * that closes it, and the rail stays mounted while closed so it slides out
 * rather than vanishing.
 */
export function StudentDetailRail({
  dossier,
  open,
  onClose,
}: {
  dossier: StudentDossier;
  /** The listing to show, or null when the rail is parked off-screen. */
  open: RailKey | null;
  onClose: () => void;
}) {
  // Escape closes it wherever the focus happens to be — the rail is a region of
  // the page rather than a dialog, so nothing else is listening for it.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // The last key it was opened with, kept through the slide out so the rail
  // doesn't blank a frame before it has left the screen.
  //
  // Adjusted during render rather than in an effect — React's own pattern for a
  // value derived from a prop. An effect would paint the emptied rail first and
  // fill it back in on the next frame, which is the flicker this exists to
  // avoid.
  const [shown, setShown] = React.useState<RailKey | null>(open);
  if (open !== null && open !== shown) setShown(open);

  const summary = summarise(dossier);
  const { student } = dossier;
  const slot = { variant: "flush", onClose } as const;

  return (
    <>
      {/* Only below `lg`, where the rail covers the page instead of moving it.
          Undimmed on purpose: this is a listing the reader opened over their
          own page, not a modal that has taken the page away from them. */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        aria-label="Student details"
        inert={!open}
        style={{ transitionDuration: `${RAIL_MS}ms` }}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden border-l bg-popover text-popover-foreground shadow-xl",
          RAIL_WIDTH,
          "transition-[translate,opacity] ease-out motion-reduce:transition-none",
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0",
        )}
      >
        {/* Whose listing this is. The tile that opened it is behind the rail on
            a narrow screen, and one line of "these are X's marks" costs less
            than closing the rail to check. */}
        <p className="shrink-0 truncate border-b bg-popover px-5 pt-4 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {student.name || "Unnamed student"}
        </p>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {shown === "homework" && (
            <StudentHomeworkPanel
              {...slot}
              submissions={dossier.submissions}
              summary={summary}
            />
          )}

          {shown === "attendance" && (
            <StudentAttendancePanel
              {...slot}
              classes={dossier.classes}
              summary={summary}
            />
          )}

          {shown === "groups" && (
            <StudentGroupsPanel {...slot} groups={dossier.groups} />
          )}

          {shown === "modules" && (
            <StudentModulesPanel {...slot} modules={dossier.modules} />
          )}

          {shown === "context" && (
            // Keyed on the note itself: a reload that brings a different one
            // starts the field again, rather than leaving a draft measured
            // against a version that has since moved on.
            <StudentNotesCard
              {...slot}
              key={student.notes}
              studentId={student.id}
              notes={student.notes}
            />
          )}

          {shown === "reports" && (
            <StudentUnitReportsCard
              {...slot}
              studentId={student.id}
              moduleId={student.moduleId}
              moduleName={student.module}
            />
          )}
        </div>
      </aside>
    </>
  );
}
