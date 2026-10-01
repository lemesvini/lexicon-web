import { LessonCombobox } from "@/components/lesson-combobox";
import { AutoTextarea } from "@/features/blocks";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

/**
 * The header of a homework: what it's called, what it's filed under, and the
 * instructions the student reads first.
 *
 * The lesson picker is searchable and offers every lesson in the library, grouped
 * by module, rather than only those in some current module — homework is written when it is written, and filed when
 * the lesson it belongs to is ready. Leaving it unattached is a first-class
 * choice, not an omission: the student view joins through `lesson_id`, so an
 * unattached homework is simply not published to anyone yet.
 */
export function HomeworkMetaEditor({
  id,
  title,
  lessonId,
  instructions,
  lessons,
  idLocked,
  onChange,
}: {
  id: string;
  title: string;
  lessonId: string | null;
  instructions: string;
  lessons: CloudLessonSummary[];
  /** True once it has been saved: the id keys the row, so editing it here would
   *  create a second homework rather than rename this one. */
  idLocked: boolean;
  onChange: (patch: {
    id?: string;
    title?: string;
    lessonId?: string | null;
    instructions?: string;
  }) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <input
        value={title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Homework title"
        className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Homework id
          </span>
          <input
            value={id}
            onChange={(e) => onChange({ id: e.target.value })}
            disabled={idLocked}
            placeholder="unit-one-homework"
            className={`${inputClass} font-mono text-xs disabled:cursor-not-allowed disabled:text-muted-foreground`}
          />
          {idLocked && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Fixed once saved — it's what the row is keyed by.
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attached to
          </span>
          <LessonCombobox
            lessons={lessons}
            value={lessonId}
            onChange={(id) => onChange({ lessonId: id })}
            allowNone
            noneLabel="Not attached — file it later"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Instructions
        </span>
        <AutoTextarea
          value={instructions}
          onValueChange={(value) => onChange({ instructions: value })}
          placeholder="What the student should do, and by when…"
          className="overflow-hidden rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}
