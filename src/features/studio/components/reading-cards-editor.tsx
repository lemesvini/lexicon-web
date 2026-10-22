import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleCheckIcon,
  CircleIcon,
  LibraryIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LessonCombobox } from "@/components/lesson-combobox";
import { AutoTextarea } from "@/features/blocks";
import { READINGS } from "@/features/practice/data/readings";
import { newBlockId } from "@/features/blocks/block-id";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import {
  newReadingQuestion,
  newReadingText,
  type ReadingQuestion,
  type ReadingText,
} from "../data/practice";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const triggerClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm data-[size=default]:h-auto shadow-none dark:bg-background dark:hover:bg-background";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const NO_LEVEL = "none";

/** Paragraphs are typed as one text, a blank line between them. Not trimmed
 *  here — that would eat the blank line being typed; the save trims. */
const toParagraphs = (text: string) => text.split(/\n[ \t]*\n/);

/** The web's reading library, as texts for this deck: fresh ids, so importing
 *  twice makes copies rather than clashing. */
function sampleTexts(): ReadingText[] {
  return READINGS.map((reading) => ({
    id: newBlockId(),
    title: reading.title,
    level: reading.level,
    blurb: reading.blurb,
    paragraphs: [...reading.paragraphs],
    questions: reading.questions.map((question) => ({
      id: newBlockId(),
      prompt: question.prompt,
      options: [...question.options],
      answer: question.answer,
    })),
  }));
}

function QuestionEditor({
  question,
  number,
  onChange,
  onRemove,
}: {
  question: ReadingQuestion;
  number: number;
  onChange: (question: ReadingQuestion) => void;
  onRemove: () => void;
}) {
  const setOption = (index: number, value: string) =>
    onChange({ ...question, options: question.options.map((o, i) => (i === index ? value : o)) });

  const removeOption = (index: number) =>
    onChange({
      ...question,
      options: question.options.filter((_, i) => i !== index),
      // The right answer keeps pointing at the same option.
      answer:
        index === question.answer ? 0 : index < question.answer ? question.answer - 1 : question.answer,
    });

  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{number}.</span>
        <input
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="What time does Lucas wake up?"
          className={inputClass}
        />
        <Button variant="ghost" size="icon-sm" title="Delete question" className="text-destructive" onClick={onRemove}>
          <Trash2Icon />
          <span className="sr-only">Delete question</span>
        </Button>
      </div>
      <ul className="space-y-1.5 pl-6">
        {question.options.map((option, index) => {
          const right = index === question.answer;
          return (
            <li key={index} className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                title={right ? "The right answer" : "Make this the right answer"}
                className={right ? "text-emerald-600" : "text-muted-foreground"}
                onClick={() => onChange({ ...question, answer: index })}
              >
                {right ? <CircleCheckIcon /> : <CircleIcon />}
                <span className="sr-only">Right answer</span>
              </Button>
              <input
                value={option}
                onChange={(e) => setOption(index, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                className={inputClass}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                title="Remove option"
                disabled={question.options.length <= 2}
                onClick={() => removeOption(index)}
              >
                <XIcon />
                <span className="sr-only">Remove option</span>
              </Button>
            </li>
          );
        })}
      </ul>
      {question.options.length < 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-6"
          onClick={() => onChange({ ...question, options: [...question.options, ""] })}
        >
          <PlusIcon />
          Option
        </Button>
      )}
    </div>
  );
}

/**
 * A reading deck: texts, each with its multiple-choice questions — the web's
 * reading library, by module. The student reads the text, then answers the
 * questions one at a time, each marked with the text's title.
 */
export function ReadingCardsEditor({
  cards,
  lessons,
  module,
  onChange,
}: {
  cards: ReadingText[];
  lessons: CloudLessonSummary[];
  module: string;
  onChange: (cards: ReadingText[]) => void;
}) {
  const update = (index: number, patch: Partial<ReadingText>) =>
    onChange(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => onChange([...cards, ...sampleTexts()])}
          title="Adds the eight texts of the students' web practice, A1 to B2"
        >
          <LibraryIcon />
          Import the web's reading texts
        </Button>
      </div>

      {cards.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No texts yet — add one, or import the web's.
        </div>
      )}

      {cards.map((card, index) => {
        const ready = card.questions.filter(
          (q) => q.prompt.trim() && q.options.filter((o) => o.trim()).length >= 2,
        ).length;
        const incomplete =
          !card.title.trim() || !card.paragraphs.some((p) => p.trim()) || ready === 0;
        return (
          <article key={card.id} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {index + 1}
                {incomplete && (
                  <span className="ml-2 font-normal text-amber-700">
                    Needs a title, the text and a question — students won't see it until then
                  </span>
                )}
              </span>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon-sm" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUpIcon />
                  <span className="sr-only">Move up</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Move down"
                  disabled={index === cards.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                  <span className="sr-only">Move down</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete text"
                  className="text-destructive"
                  onClick={() => onChange(cards.filter((_, i) => i !== index))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete text</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block sm:col-span-3">
                <span className={labelClass}>Title</span>
                <input
                  value={card.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  placeholder="My Morning"
                  className={`${inputClass} font-semibold`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Level</span>
                <Select
                  value={card.level ?? NO_LEVEL}
                  onValueChange={(level) => update(index, { level: level === NO_LEVEL ? undefined : level })}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LEVEL}>—</SelectItem>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Em uma linha (português)</span>
                <input
                  value={card.blurb ?? ""}
                  onChange={(e) => update(index, { blurb: e.target.value })}
                  placeholder="Uma rotina simples de manhã, no presente."
                  className={inputClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>From lesson</span>
                <LessonCombobox
                  lessons={lessons}
                  module={module}
                  value={card.lessonId ?? null}
                  onChange={(id) => update(index, { lessonId: id ?? undefined })}
                  allowNone
                  noneLabel="No lesson — always available"
                />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Text — a blank line between paragraphs</span>
              <AutoTextarea
                value={card.paragraphs.join("\n\n")}
                onValueChange={(value) => update(index, { paragraphs: toParagraphs(value) })}
                placeholder="My name is Lucas. I wake up at seven o'clock every day…"
                className="min-h-28 overflow-hidden rounded-md border bg-background px-3 py-2 text-sm leading-relaxed"
              />
            </label>

            <div className="space-y-2">
              <span className={labelClass}>Questions ({card.questions.length})</span>
              {card.questions.map((question, qi) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  number={qi + 1}
                  onChange={(next) =>
                    update(index, { questions: card.questions.map((q, i) => (i === qi ? next : q)) })
                  }
                  onRemove={() => update(index, { questions: card.questions.filter((_, i) => i !== qi) })}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update(index, { questions: [...card.questions, newReadingQuestion()] })}
              >
                <PlusIcon />
                Question
              </Button>
            </div>
          </article>
        );
      })}

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => {
          const last = cards[cards.length - 1];
          onChange([...cards, { ...newReadingText(), lessonId: last?.lessonId }]);
        }}
      >
        <PlusIcon />
        Add text
      </Button>
    </div>
  );
}
