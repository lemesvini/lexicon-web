import { Badge } from "@/components/ui/badge";
import { AutoTextarea } from "@/features/blocks";

/** Just the identifying fields — satisfied by both a full `Lesson` and a
 *  `CloudLessonSummary`, so the caller passes whichever it already has. */
type LessonIdentity = {
  id: string;
  title: string;
  unit: string;
  module: string;
};

/**
 * The header of a student material.
 *
 * Almost everything here is read-only, and that is the point: a material has no
 * title, unit or module of its own — it is the student's copy of one particular
 * lesson, and those fields belong to the lesson. Giving it editable copies would
 * be inventing exactly the kind of drift that `lessons.module` already suffers
 * from (see supabase/migrations/0003_module_management.sql).
 *
 * The one thing that is the material's own is the intro: what the student reads
 * before the content, in place of the class context written for the teacher.
 */
export function MaterialMetaEditor({
  lesson,
  intro,
  onIntroChange,
}: {
  lesson: LessonIdentity;
  intro: string;
  onIntroChange: (intro: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {lesson.title || lesson.id}
        </h1>
        {lesson.module && (
          <Badge variant="outline" className="text-muted-foreground">
            {lesson.module}
          </Badge>
        )}
      </div>

      {lesson.unit && (
        <p className="mt-1 text-sm text-muted-foreground">{lesson.unit}</p>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Intro for the student
        </span>
        <AutoTextarea
          value={intro}
          onValueChange={onIntroChange}
          placeholder="A line or two setting up the lesson, in words written for them…"
          className="overflow-hidden rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}
