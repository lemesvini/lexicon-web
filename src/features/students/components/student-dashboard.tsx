import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CURRENCY, formatMoney } from "@/features/finance/data/finance";
import {
  RAIL_MS,
  RAIL_PADDING,
  StudentDetailRail,
} from "@/features/students/components/student-detail-rail";
import { StudentActionBar } from "@/features/students/components/student-action-bar";
import { StudentProfileCard } from "@/features/students/components/student-profile-card";
import {
  EditAttendanceDialog,
  ResetPasswordDialog,
} from "@/features/students/components/student-quick-actions";
import {
  CATEGORY_ICON,
  CategoryTile,
  describeCategories,
  StatTile,
  type RailKey,
} from "@/features/students/components/student-tiles";
import { formatMark, formatPercent } from "@/features/students/components/student-formats";
import {
  fetchStudentDossier,
  summarise,
  type StudentDossier,
} from "@/features/students/data/student-profile";
import {
  listModules,
  listTeacherOptions,
  type ModuleOption,
  type TeacherOption,
} from "@/features/students/data/students";

/**
 * Where each tile sits in the gallery.
 *
 * Not every tile is the same size, and that is the point: the profile is a tall
 * block you read down, a figure is a small square you glance at, and a category
 * is a sentence that wants a line's worth of width. Sizing them all alike would
 * make the page a spreadsheet.
 *
 * The spans are chosen so each row fills exactly — at six columns the profile
 * holds the left two for two rows while homework takes the other four, then two
 * figures slot in beside it; at four the same spans fall into pairs. Nothing is
 * left hanging off the end of a row, at either width.
 *
 * These are container queries, not viewport ones. The gallery narrows when the
 * rail opens, and it should reflow because *it* got narrower — not because the
 * window did, which it didn't.
 */
const SPAN = {
  profile: "@xl:col-span-2 @xl:row-span-2",
  wide: "@xl:col-span-2 @4xl:col-span-4",
  half: "@xl:col-span-2",
} as const;

/** The gallery's own grid. Shared with the loading state so the page doesn't
 *  change shape underneath the reader as the dossier lands. */
const GALLERY = "grid grid-cols-1 gap-4 @xl:grid-cols-4 @4xl:grid-cols-6";

/**
 * Everything the school knows about one student, as a gallery of tiles — who
 * they are, the figures, and the categories that open onto their listings.
 *
 * Owns the page's whole frame, header included, because opening a listing moves
 * the frame: the rail is a full-height column down the right edge and the page
 * gives up exactly its width, so the nav slides left along with everything
 * under it. A dashboard that only owned the area below the header would leave
 * the header sitting still while the page beneath it moved.
 *
 * Reloads the whole dossier after any change rather than patching the copy in
 * state: changing a module writes to `student_modules` as well as the roster
 * row, and a page that only updated the badge would be showing a history that
 * disagrees with it.
 */
export function StudentDashboard({ studentId }: { studentId: string }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [phase, setPhase] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [dossier, setDossier] = React.useState<StudentDossier | null>(null);
  const [modules, setModules] = React.useState<ModuleOption[]>([]);
  const [teachers, setTeachers] = React.useState<TeacherOption[]>([]);
  const [reloadKey, setReloadKey] = React.useState(0);
  // Which listing the rail is showing. Clicking the open tile again closes it —
  // the tile is the control, so it is also the way back out.
  const [rail, setRail] = React.useState<RailKey | null>(null);
  // Which quick action is open, if any. One value rather than a flag apiece —
  // the toolbar only ever has one dialog up.
  const [action, setAction] = React.useState<"password" | "attendance" | null>(
    null,
  );
  // Shown verbatim on failure. These are staff screens, and a Postgres message
  // says what went wrong far better than "something did".
  const [failure, setFailure] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    // The pickers are fetched alongside the dossier rather than on demand: the
    // profile tile's actions menu needs them from the moment it is on screen,
    // and a menu that has to load before it can offer anything opens empty.
    Promise.all([fetchStudentDossier(studentId), listModules(), listTeacherOptions()])
      .then(([next, moduleOptions, teacherOptions]) => {
        if (cancelled) return;
        setModules(moduleOptions);
        setTeachers(teacherOptions);
        if (!next) {
          setPhase("missing");
          return;
        }
        setDossier(next);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure((err as Error).message ?? "");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);
  const closeRail = React.useCallback(() => setRail(null), []);
  const toggleRail = React.useCallback(
    (key: RailKey) => setRail((current) => (current === key ? null : key)),
    [],
  );

  const ready = phase === "ready" && dossier !== null;
  const summary = dossier ? summarise(dossier) : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Everything the reader sees except the rail. The padding is the rail's
          own width, so opening it slides the header and the gallery left by
          exactly the room the rail needs — no overlap, and nothing hidden
          underneath it. Below `lg` there is no width to spare, so the rail
          covers the page instead and this stays put. */}
      <div
        style={{ transitionDuration: `${RAIL_MS}ms` }}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-[padding] ease-out motion-reduce:transition-none",
          rail && RAIL_PADDING,
        )}
      >
        <SiteNav backTo="/students" backLabel="Back to the roster" />

        <main className="@container mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-3 pt-2 pb-20 sm:px-4 sm:pt-4">
          {phase === "loading" && (
            <div className={GALLERY}>
              <Skeleton className={cn("h-64 rounded-xl", SPAN.profile)} />
              <Skeleton className={cn("h-32 rounded-xl", SPAN.wide)} />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className={cn("h-32 rounded-xl", SPAN.half)} />
              ))}
            </div>
          )}

          {phase === "missing" && (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground">
              No such student — or they belong to another teacher.
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn’t load this student.
              </p>
              {failure && (
                <p className="max-w-lg font-mono text-xs text-destructive">
                  {failure}
                </p>
              )}
              <Button
                onClick={() => {
                  setPhase("loading");
                  reload();
                }}
              >
                <RefreshCwIcon />
                Try again
              </Button>
            </div>
          )}

          {ready && summary && (
            <>
              <div className="min-h-0 flex-1 overflow-hidden">
                <Gallery
                  dossier={dossier}
                  summary={summary}
                  isAdmin={isAdmin}
                  modules={modules}
                  teachers={teachers}
                  onChanged={reload}
                  rail={rail}
                  onToggleRail={toggleRail}
                />
              </div>

              <StudentActionBar
                canResetPassword={dossier.student.userId !== null}
                canEditAttendance={dossier.classes.length > 0}
                onResetPassword={() => setAction("password")}
                onEditAttendance={() => setAction("attendance")}
              />
            </>
          )}
        </main>
      </div>

      {dossier && (
        <StudentDetailRail dossier={dossier} open={rail} onClose={closeRail} />
      )}

      {dossier && (
        <>
          <ResetPasswordDialog
            student={dossier.student}
            open={action === "password"}
            onOpenChange={(next) => setAction(next ? "password" : null)}
          />
          <EditAttendanceDialog
            classes={dossier.classes}
            open={action === "attendance"}
            onOpenChange={(next) => setAction(next ? "attendance" : null)}
            onChanged={reload}
          />
        </>
      )}
    </div>
  );
}

/** The tiles themselves, in the order they are read: who, then how they are
 *  doing, then what there is to look at. */
function Gallery({
  dossier,
  summary,
  isAdmin,
  modules,
  teachers,
  onChanged,
  rail,
  onToggleRail,
}: {
  dossier: StudentDossier;
  summary: NonNullable<ReturnType<typeof summarise>>;
  isAdmin: boolean;
  modules: ModuleOption[];
  teachers: TeacherOption[];
  onChanged: () => void;
  rail: RailKey | null;
  onToggleRail: (key: RailKey) => void;
}) {
  const { student } = dossier;
  const handedIn = summary.gradedCount + summary.awaitingCount;
  const copy = describeCategories(dossier, summary);

  return (
    <div className={GALLERY}>
      <StudentProfileCard
        span={SPAN.profile}
        student={student}
        lastActivity={summary.lastActivity}
        isAdmin={isAdmin}
        modules={modules}
        teachers={teachers}
        onChanged={onChanged}
      />

      <CategoryTile
        span={SPAN.wide}
        icon={CATEGORY_ICON.homework}
        title="Homework"
        description={copy.homework}
        active={rail === "homework"}
        onClick={() => onToggleRail("homework")}
      />

      <StatTile
        span={SPAN.half}
        label="Average mark"
        muted={summary.averageScore === null}
        value={
          summary.averageScore === null ? (
            "—"
          ) : (
            <>
              {formatMark(summary.averageScore)}
              <span className="text-lg font-normal text-muted-foreground">
                /10
              </span>
            </>
          )
        }
        caption={
          summary.averageScore === null
            ? "Nothing corrected yet"
            : [
                `across ${summary.gradedCount} corrected`,
                summary.latestScore !== null &&
                  `latest ${formatMark(summary.latestScore)}`,
              ]
                .filter(Boolean)
                .join(" · ")
        }
      />

      <StatTile
        span={SPAN.half}
        label="Handed in"
        muted={handedIn === 0}
        value={handedIn}
        caption={
          [
            summary.awaitingCount > 0 && `${summary.awaitingCount} to correct`,
            summary.startedCount > 0 && `${summary.startedCount} still open`,
          ]
            .filter(Boolean)
            .join(" · ") || "Nothing waiting"
        }
      />

      {/* The one figure with a listing behind it, so the one that opens the
          rail. The register is where the percentage comes from, and it is the
          number people query. */}
      <StatTile
        span={SPAN.half}
        label="Attendance"
        muted={summary.attendanceRate === null}
        value={formatPercent(summary.attendanceRate)}
        caption={
          summary.classesRecorded === 0
            ? "No register taken yet"
            : `${summary.classesAttended} of ${summary.classesRecorded} classes`
        }
        active={rail === "attendance"}
        onClick={() => onToggleRail("attendance")}
      />

      <StatTile
        span={SPAN.half}
        label={`Monthly fee (${CURRENCY})`}
        muted={student.monthlyFee === null}
        value={student.monthlyFee === null ? "—" : formatMoney(student.monthlyFee)}
        caption={
          student.monthlyFee === null
            ? "Not priced yet"
            : student.classesPerWeek
              ? `${student.classesPerWeek} class${student.classesPerWeek === 1 ? "" : "es"} a week`
              : "Classes a week not set"
        }
      />

      <CategoryTile
        span={SPAN.half}
        icon={CATEGORY_ICON.groups}
        title="Groups"
        description={copy.groups}
        active={rail === "groups"}
        onClick={() => onToggleRail("groups")}
      />

      <CategoryTile
        span={SPAN.half}
        icon={CATEGORY_ICON.modules}
        title="Modules"
        description={copy.modules}
        active={rail === "modules"}
        onClick={() => onToggleRail("modules")}
      />

      <CategoryTile
        span={SPAN.half}
        icon={CATEGORY_ICON.context}
        title="Student's Context"
        description={copy.context}
        active={rail === "context"}
        onClick={() => onToggleRail("context")}
      />

      <CategoryTile
        span={SPAN.half}
        icon={CATEGORY_ICON.reports}
        title="Progress reports"
        description={copy.reports}
        active={rail === "reports"}
        onClick={() => onToggleRail("reports")}
      />
    </div>
  );
}
