import * as React from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  deleteUnitReport,
  listUnitReports,
  saveUnitReport,
  type UnitReport,
} from "@/features/students/data/unit-reports";
import {
  StudentPanel,
  StudentPanelEmpty,
  type PanelSlotProps,
} from "@/features/students/components/student-panel";

const field =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30";

/** A score as it reads on a card. Null means no test was recorded, which is not
 *  a zero — the unit may simply not have had one yet. */
function formatScore(score: number | null): string {
  return score === null ? "—" : `${score}/10`;
}

type Draft = {
  unit: string;
  observations: string;
  testScore: string;
  teacherNotes: string;
};

const BLANK: Draft = {
  unit: "",
  observations: "",
  testScore: "",
  teacherNotes: "",
};

/**
 * What happened, unit by unit — the observations from the weeks, and the test at
 * the end of them.
 *
 * Written down rather than remembered, for two readers. The teacher, next term,
 * who otherwise has to reconstruct why a student was moved; and the
 * advanced-context suggestions, for which this is the only evidence of how the
 * class is actually doing as opposed to what it was taught.
 *
 * Saved explicitly, like the context note beside it — a half-written observation
 * is not a fact about a student.
 */
export function StudentUnitReportsCard({
  studentId,
  moduleId,
  moduleName,
  ...slot
}: {
  studentId: string;
  /** The module the reports are filed under — the student's current one. Without
   *  it there is nothing to number a unit within, so the form is withheld rather
   *  than offered with a field that can't be filled. */
  moduleId: string | null;
  moduleName: string;
} & PanelSlotProps) {
  const [reports, setReports] = React.useState<UnitReport[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft>(BLANK);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listUnitReports(studentId)
      .then((rows) => {
        if (cancelled) return;
        setReports(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unit = Number(draft.unit);
  const score = draft.testScore.trim() === "" ? null : Number(draft.testScore);
  const validScore =
    score === null || (Number.isFinite(score) && score >= 0 && score <= 10);
  const canSave =
    !!moduleId && Number.isInteger(unit) && unit > 0 && validScore && !busy;

  const submit = () =>
    run(async () => {
      if (!moduleId) return;
      await saveUnitReport({
        studentId,
        moduleId,
        unit,
        observations: draft.observations,
        testScore: score,
        teacherNotes: draft.teacherNotes,
      });
      setDraft(BLANK);
      setAdding(false);
    });

  /** Puts an existing report back in the form. The write upserts on
   *  (student, module, unit), so saving it again updates that same row. */
  const edit = (report: UnitReport) => {
    setDraft({
      unit: String(report.unit),
      observations: report.observations,
      testScore: report.testScore === null ? "" : String(report.testScore),
      teacherNotes: report.teacherNotes,
    });
    setAdding(true);
  };

  return (
    <StudentPanel
      {...slot}
      title="Progress reports"
      meta={
        status === "ready" && reports.length > 0 ? (
          <span>
            {reports.length} unit{reports.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {status === "loading" ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Couldn’t load the reports.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("loading");
                reload();
              }}
            >
              Try again
            </Button>
          </div>
        ) : reports.length === 0 && !adding ? (
          <StudentPanelEmpty>
            Nothing recorded yet. A report per unit — what happened, and how the
            test went — is what makes the next term’s planning about this student
            rather than about the syllabus.
          </StudentPanelEmpty>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.id}
                className="space-y-1.5 rounded-lg border bg-background p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    Unit {report.unit}
                    {report.moduleName && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {report.moduleName}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      report.testScore !== null && report.testScore < 6
                        ? "font-medium text-amber-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatScore(report.testScore)}
                  </span>
                </div>

                {report.observations && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {report.observations}
                  </p>
                )}
                {report.teacherNotes && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    On the test: {report.teacherNotes}
                  </p>
                )}

                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => edit(report)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete the report for unit ${report.unit}? This can't be undone.`,
                        )
                      ) {
                        void run(() => deleteUnitReport(report.id));
                      }
                    }}
                  >
                    <Trash2Icon />
                    <span className="sr-only">
                      Delete the report for unit {report.unit}
                    </span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="flex gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Unit</span>
                <input
                  type="number"
                  min={1}
                  value={draft.unit}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, unit: e.target.value }))
                  }
                  className={field}
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">
                  Test score (0–10)
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={draft.testScore}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, testScore: e.target.value }))
                  }
                  placeholder="No test"
                  className={field}
                />
              </label>
            </div>

            <textarea
              value={draft.observations}
              onChange={(e) =>
                setDraft((d) => ({ ...d, observations: e.target.value }))
              }
              rows={3}
              placeholder="What happened over the unit — what clicked, what didn't, what they kept getting wrong."
              className={cn(field, "resize-y leading-relaxed")}
            />

            <textarea
              value={draft.teacherNotes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, teacherNotes: e.target.value }))
              }
              rows={2}
              placeholder="Your read on the test itself."
              className={cn(field, "resize-y leading-relaxed")}
            />

            {!moduleId && (
              <p className="text-xs text-amber-600">
                This student has no module set, so there’s nothing to file a unit
                under. Set one on their profile first.
              </p>
            )}
            {!validScore && (
              <p className="text-xs text-amber-600">
                A test score has to be between 0 and 10.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setDraft(BLANK);
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={!canSave} onClick={() => void submit()}>
                {busy && <Loader2Icon className="animate-spin" />}
                Save report
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            Add a report
            {moduleName && (
              <span className="text-muted-foreground">· {moduleName}</span>
            )}
          </Button>
        )}
      </div>
    </StudentPanel>
  );
}
