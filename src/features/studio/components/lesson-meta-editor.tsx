import * as React from "react";
import { XIcon } from "lucide-react";
import type { Lesson } from "@/lib/lessons";
import { AddRowButton, AutoTextarea, DeleteRowButton } from "@/features/blocks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listModuleNames } from "@/features/modules/data/modules";

type Meta = Omit<Lesson, "slides">;
type ClassPlanRow = Meta["classPlan"][number];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldClass = "w-full rounded-md border bg-background px-3 py-1.5 text-sm";

const inputClass = `${fieldClass} outline-none focus:ring-2 focus:ring-ring/30`;

// Radix's Select has no concept of an empty value, so "no module" needs a
// sentinel — one no real module could be called.
const NO_MODULE_VALUE = "__none__";

// Sits level with the plain inputs beside it: same box, no shadow, and the
// trigger's fixed height overridden under the very same variant, so that
// tailwind-merge sees the conflict and drops it.
const triggerClass = `${fieldClass} data-[size=default]:h-auto shadow-none dark:bg-background dark:hover:bg-background`;

/**
 * The lesson's module, picked from the ones that exist rather than typed.
 *
 * A lesson is filed by module *name* — `lessons.module` matched against
 * `modules.name`, no foreign key — so a typo here doesn't fail loudly, it files
 * the lesson somewhere no student is looking. A picker is the fix.
 *
 * It fetches its own list instead of taking one as a prop: nothing else on this
 * card needs the modules, and the editor's route already has a load of its own
 * to worry about.
 */
function ModuleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (module: string) => void;
}) {
  const [names, setNames] = React.useState<string[]>([]);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listModuleNames()
      .then((moduleNames) => {
        if (!cancelled) setNames(moduleNames);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the list can't be loaded, the field stays what it always was: free text.
  // A picker with nothing in it would make the lesson uneditable.
  if (failed) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Module One"
        className={inputClass}
      />
    );
  }

  const current = value.trim();

  // The lesson's own module is always an option, even when it isn't in the list
  // — it may have been renamed elsewhere or deactivated, and it is still loading
  // on first paint. Dropping it would let a save quietly re-file the lesson.
  const options =
    current && !names.includes(current) ? [current, ...names] : names;

  return (
    <Select
      value={current || NO_MODULE_VALUE}
      onValueChange={(next) =>
        onChange(next === NO_MODULE_VALUE ? "" : next)
      }
    >
      <SelectTrigger className={triggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_MODULE_VALUE}>No module</SelectItem>
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GrammarTags({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const commit = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="hover:text-destructive"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? "" : "Add focus, press Enter…"}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function ClassPlan({
  plan,
  onChange,
}: {
  plan: ClassPlanRow[];
  onChange: (p: ClassPlanRow[]) => void;
}) {
  const set = (i: number, patch: Partial<ClassPlanRow>) =>
    onChange(plan.map((row, ri) => (ri === i ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-1.5">
      {plan.map((row, i) => (
        <div key={i} className="group/row flex items-center gap-2">
          <input
            value={row.stage}
            onChange={(e) => set(i, { stage: e.target.value })}
            placeholder="Stage"
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={row.duration}
            onChange={(e) => set(i, { duration: e.target.value })}
            placeholder="10 min"
            className="w-20 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={row.goal}
            onChange={(e) => set(i, { goal: e.target.value })}
            placeholder="Goal"
            className="flex-[2] rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="opacity-0 transition-opacity group-hover/row:opacity-100">
            <DeleteRowButton
              onClick={() => onChange(plan.filter((_, ri) => ri !== i))}
              label="Remove stage"
            />
          </span>
        </div>
      ))}
      <AddRowButton
        onClick={() => onChange([...plan, { stage: "", duration: "", goal: "" }])}
        label="Add stage"
      />
    </div>
  );
}

export function LessonMetaEditor({
  meta,
  onChange,
}: {
  meta: Meta;
  onChange: (patch: Partial<Meta>) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <input
        value={meta.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Lesson title"
        className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Lesson id">
          <input
            value={meta.id}
            onChange={(e) => onChange({ id: e.target.value })}
            placeholder="unit-one-situation-one"
            className={`${inputClass} font-mono text-xs`}
          />
        </Field>
        <Field label="Module">
          <ModuleSelect
            value={meta.module}
            onChange={(module) => onChange({ module })}
          />
        </Field>
        <Field label="Unit">
          <input
            value={meta.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="Unit One - Introductions"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Context">
          <AutoTextarea
            value={meta.context}
            onValueChange={(context) => onChange({ context })}
            placeholder="The situation the lesson is built around…"
            className="rounded-md border bg-background px-3 py-1.5 text-sm overflow-hidden"
          />
        </Field>
        <Field label="Minor Can-Do">
          <AutoTextarea
            value={meta.minorCanDo}
            onValueChange={(minorCanDo) => onChange({ minorCanDo })}
            placeholder="What the student should be able to do…"
            className="rounded-md border bg-background px-3 py-1.5 text-sm overflow-hidden"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Grammar focus">
          <GrammarTags
            tags={meta.grammarFocus}
            onChange={(grammarFocus) => onChange({ grammarFocus })}
          />
        </Field>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-muted-foreground marker:content-none">
          <span className="group-open:hidden">▸ Class plan</span>
          <span className="hidden group-open:inline">▾ Class plan</span>
        </summary>
        <div className="mt-3">
          <ClassPlan
            plan={meta.classPlan}
            onChange={(classPlan) => onChange({ classPlan })}
          />
        </div>
      </details>
    </div>
  );
}
