import * as React from "react";
import {
  ClipboardCheckIcon,
  MailIcon,
  PhoneIcon,
  RefreshCwIcon,
  UserCogIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CURRENCY, formatMoney } from "@/features/finance/data/finance";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import { StudentHomeworkPanel } from "@/features/students/components/student-homework-panel";
import { StudentNotesCard } from "@/features/students/components/student-notes-card";
import {
  StudentAttendancePanel,
  StudentGroupsPanel,
  StudentModulesPanel,
} from "@/features/students/components/student-side-panels";
import {
  formatDate,
  formatMark,
  formatPercent,
  formatSince,
} from "@/features/students/components/student-formats";
import {
  fetchStudentDossier,
  summarise,
  type StudentDossier,
  type StudentSummary,
} from "@/features/students/data/student-profile";
import {
  listModules,
  listTeacherOptions,
  NO_MODULE,
  NO_TEACHER,
  type ModuleOption,
  type StudentRow,
  type TeacherOption,
} from "@/features/students/data/students";

/**
 * One figure across the top of the page: a label, the number, and one line
 * saying what it is out of.
 *
 * The caption is not optional by accident. A bare "82%" invites the reader to
 * supply their own denominator, and on this page every one of these is out of
 * something the school only partly knows — marks out of the homework corrected,
 * attendance out of the registers actually taken.
 */
function StatCard({
  label,
  value,
  caption,
  /** Dims the value where there is nothing yet, so an empty stat doesn't read
   *  with the same weight as a real one. */
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 text-card-foreground">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

/** The four figures, in the order the questions get asked: how are they doing,
 *  are they doing the work, are they turning up, what do they pay. */
function StatRow({
  dossier,
  summary,
}: {
  dossier: StudentDossier;
  summary: StudentSummary;
}) {
  const { student } = dossier;
  const handedIn = summary.gradedCount + summary.awaitingCount;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
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

      <StatCard
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

      <StatCard
        label="Attendance"
        muted={summary.attendanceRate === null}
        value={formatPercent(summary.attendanceRate)}
        caption={
          summary.classesRecorded === 0
            ? "No register taken yet"
            : `${summary.classesAttended} of ${summary.classesRecorded} classes`
        }
      />

      <StatCard
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
    </div>
  );
}

/** One line of the contact strip under the name. */
function Detail({
  icon: Icon,
  children,
}: {
  icon: typeof MailIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * Everything the school knows about one student, on one page.
 *
 * The roster's row actions come along at the top — change their module, hand
 * them to another teacher, issue a password — because this is where you end up
 * when you go looking at a student, and sending you back to a table to act on
 * what you just read is a round trip with no purpose.
 *
 * Reloads the whole dossier after any of those, rather than patching the copy in
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
  // Shown verbatim on failure. These are staff screens, and a Postgres message
  // says what went wrong far better than "something did".
  const [failure, setFailure] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    // The pickers are fetched alongside the dossier rather than on demand: the
    // actions menu is in the header, and a menu that has to load before it can
    // offer anything opens empty.
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

  if (phase === "loading") {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "missing") {
    return (
      <div className="rounded-xl border p-6 text-sm text-muted-foreground">
        No such student — or they belong to another teacher.
      </div>
    );
  }

  if (phase === "error" || !dossier) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn’t load this student.
        </p>
        {failure && (
          <p className="max-w-lg font-mono text-xs text-destructive">{failure}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPhase("loading");
            reload();
          }}
        >
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  const { student } = dossier;
  const summary = summarise(dossier);

  // `StudentRowActions` is written against a roster row, so the dossier is
  // narrowed back to one rather than the menu being rewritten. The placeholders
  // are the roster's own — they are what its dialogs expect to see.
  const asRow: StudentRow = {
    id: student.id,
    userId: student.userId,
    name: student.name,
    email: student.email,
    phone: student.phone,
    status: student.status,
    moduleId: student.moduleId,
    module: student.module || NO_MODULE,
    teacherId: student.teacherId,
    teacher: student.teacher || NO_TEACHER,
    createdAt: student.createdAt,
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {student.name || "Unnamed student"}
            </h1>
            {student.status === "inactive" && (
              <Badge variant="secondary">Inactive</Badge>
            )}
            {student.module && <Badge variant="outline">{student.module}</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {student.email && (
              <Detail icon={MailIcon}>
                <a
                  href={`mailto:${student.email}`}
                  className="hover:text-foreground hover:underline"
                >
                  {student.email}
                </a>
              </Detail>
            )}
            {student.phone && (
              <Detail icon={PhoneIcon}>{student.phone}</Detail>
            )}
            {student.teacher && (
              <Detail icon={UserCogIcon}>{student.teacher}</Detail>
            )}
            <Detail icon={ClipboardCheckIcon}>
              {summary.lastActivity
                ? `Last seen ${formatSince(summary.lastActivity)}`
                : "Nothing recorded yet"}
            </Detail>
          </div>

          <p className="text-xs text-muted-foreground">
            On the roster since {formatDate(student.createdAt)}
            {!student.userId && " · no sign-in account yet"}
          </p>
        </div>

        <StudentRowActions
          student={asRow}
          modules={modules}
          teachers={isAdmin ? teachers : []}
          onChanged={reload}
        />
      </header>

      <StatRow dossier={dossier} summary={summary} />

      {/* The homework is the column you came for, so it gets the width; the rest
          is context, and reads fine in a narrow rail beside it. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StudentHomeworkPanel
            submissions={dossier.submissions}
            summary={summary}
          />
        </div>

        <div className="space-y-6">
          <StudentAttendancePanel classes={dossier.classes} summary={summary} />
          <StudentGroupsPanel groups={dossier.groups} />
          <StudentModulesPanel modules={dossier.modules} />
          {/* Keyed on the note itself: a reload that brings a different one
              starts the field again, rather than leaving a draft measured
              against a version that has since moved on. */}
          <StudentNotesCard
            key={student.notes}
            studentId={student.id}
            notes={student.notes}
          />
        </div>
      </div>
    </div>
  );
}
