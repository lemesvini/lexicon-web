import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMPTY_ANSWERS,
  ONBOARDING_STEPS,
  type OnboardingAnswers,
  type OnboardingStep,
} from "../questions";

/**
 * The onboarding form, one question at a time.
 *
 * Same shape as the homework stepper (@/features/learn/components/exercise-stepper):
 * a bar above, one card, Back/Next below. A student who has done a homework has
 * already used this screen. It is a separate component rather than a reuse
 * because `ExerciseStepper` is built around a lesson document's blocks, and
 * these questions are not blocks.
 *
 * Nothing autosaves. The form is short, and a half-answered context is worse
 * than none — it gets written once, at the end.
 */
export function OnboardingStepper({
  onFinish,
  submitting,
  error,
}: {
  onFinish: (answers: OnboardingAnswers) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<OnboardingAnswers>(EMPTY_ANSWERS);

  const steps = ONBOARDING_STEPS;
  const current = Math.min(step, steps.length - 1);
  const item = steps[current];
  const isLast = current === steps.length - 1;

  // Progress counts questions answered, not steps walked — the intro is not an
  // achievement, and clicking Next four times is not being done.
  const questions = steps.filter((s) => s.kind !== "intro");
  const done = questions.filter((s) => isAnswered(s, answers)).length;
  const canAdvance = isAnswered(item, answers);

  return (
    <div className="space-y-6">
      <Progress done={done} total={questions.length} />

      <div className="rounded-xl border p-5 sm:p-6">
        <StepCard item={item} answers={answers} onChange={setAnswers} />
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error} Tente de novo em instantes.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep(current - 1)}
          disabled={current === 0 || submitting}
        >
          <ChevronLeftIcon />
          Voltar
        </Button>

        <span className="text-sm text-muted-foreground tabular-nums">
          {current + 1} / {steps.length}
        </span>

        {isLast ? (
          <Button
            onClick={() => onFinish(answers)}
            disabled={!canAdvance || submitting}
          >
            {submitting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            Concluir
          </Button>
        ) : (
          <Button onClick={() => setStep(current + 1)} disabled={!canAdvance}>
            {current === 0 ? "Vamos lá" : "Próxima"}
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

/** The intro has nothing to answer, so it is always "done". */
function isAnswered(step: OnboardingStep, answers: OnboardingAnswers): boolean {
  if (step.kind === "intro") return true;
  if (step.kind === "chips") return answers.interests.length > 0;
  return answers[step.id as "motivation" | "routine"].trim().length > 0;
}

function StepCard({
  item,
  answers,
  onChange,
}: {
  item: OnboardingStep;
  answers: OnboardingAnswers;
  onChange: React.Dispatch<React.SetStateAction<OnboardingAnswers>>;
}) {
  if (item.kind === "intro") {
    return (
      <div className="space-y-4">
        <p className="font-display text-2xl tracking-wide">{item.title}</p>
        {item.body.map((paragraph, i) => (
          <p
            key={i}
            className="font-montserrat text-sm leading-relaxed text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  const key = item.id as "motivation" | "routine";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-montserrat text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {item.title}
        </p>
        <p className="font-display text-2xl tracking-wide">{item.question}</p>
        {item.hint && (
          <p className="font-montserrat text-sm text-muted-foreground">
            {item.hint}
          </p>
        )}
      </div>

      {item.kind === "chips" ? (
        <InterestPicker
          options={item.options}
          selected={answers.interests}
          onToggle={(value) =>
            onChange((prev) => ({
              ...prev,
              interests: prev.interests.includes(value)
                ? prev.interests.filter((i) => i !== value)
                : [...prev.interests, value],
            }))
          }
        />
      ) : (
        <textarea
          value={answers[key]}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, [key]: event.target.value }))
          }
          rows={5}
          autoFocus
          placeholder={item.placeholder}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
        />
      )}
    </div>
  );
}

/**
 * Interests as pills, plus a way to add one that isn't there.
 *
 * A custom interest is pushed onto the front of the row already selected: it was
 * typed on purpose, so making the student then click it would be asking twice.
 */
function InterestPicker({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [custom, setCustom] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");

  const all = [...custom, ...options];

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    const existing = all.find(
      (option) => option.toLowerCase() === value.toLowerCase(),
    );
    if (existing) {
      if (!selected.includes(existing)) onToggle(existing);
    } else {
      setCustom((prev) => [value, ...prev]);
      onToggle(value);
    }
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {all.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Faltou algum? Escreva aqui"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!draft.trim()}
        >
          <PlusIcon />
          Adicionar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        {selected.length} selecionados
      </p>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-2">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Perguntas respondidas"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {done} de {total} respondidas
      </p>
    </div>
  );
}
