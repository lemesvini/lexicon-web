// Loads every lesson file under src/situations (any module subfolder) at build
// time. Drop in a new situation-*.json and it shows up in the table with no
// code change — the glob is resolved from the Vite project root.

type ClassPlanStage = {
  stage: string;
  duration: string;
  goal: string;
};

type RawSituation = {
  id: string;
  unit: string;
  module: string;
  title: string;
  context: string;
  minorCanDo: string;
  grammarFocus: string[];
  classPlan: ClassPlanStage[];
};

export type Situation = {
  id: string;
  title: string;
  unit: string;
  module: string;
  grammarFocus: string[];
  /** Total class-plan duration, e.g. "60 min". */
  duration: string;
};

/** Sums the numeric minutes across a lesson's class-plan stages. */
function totalDuration(classPlan: ClassPlanStage[] | undefined): string {
  const minutes = (classPlan ?? []).reduce((sum, stage) => {
    const parsed = Number.parseInt(stage.duration, 10);
    return sum + (Number.isNaN(parsed) ? 0 : parsed);
  }, 0);
  return `${minutes} min`;
}

const modules = import.meta.glob("/src/situations/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, RawSituation>;

// Coerce every field the table reads: lesson JSON may be hand-authored or
// exported without some fields, and a single undefined must not blank the list.
export const situations: Situation[] = Object.values(modules)
  .map((raw) => ({
    id: raw.id ?? "",
    title: raw.title ?? "",
    unit: raw.unit ?? "",
    module: raw.module ?? "",
    grammarFocus: raw.grammarFocus ?? [],
    duration: totalDuration(raw.classPlan),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
