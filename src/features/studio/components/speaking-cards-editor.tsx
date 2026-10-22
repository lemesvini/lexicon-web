import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  Trash2Icon,
  Volume2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LessonCombobox } from "@/components/lesson-combobox";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { newSpeakingCard, type SpeakingCard } from "../data/practice";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * Reads a card's English out loud with the browser's own voice — a check on
 * how it will sound, close to what the student's phone does with its own (the
 * app reads cards on the device; see 0031).
 */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

/**
 * A speaking deck, card by card: the Portuguese the student sees, the English
 * they have to say, an example sentence for the back, and the lesson it comes
 * from — which decides when a student gets it.
 */
export function SpeakingCardsEditor({
  cards,
  lessons,
  module,
  onChange,
}: {
  cards: SpeakingCard[];
  /** Every lesson, for each card's "from lesson" picker… */
  lessons: CloudLessonSummary[];
  /** …which lists the activity's module's own, when it has any. */
  module: string;
  onChange: (cards: SpeakingCard[]) => void;
}) {
  const update = (index: number, patch: Partial<SpeakingCard>) =>
    onChange(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const remove = (index: number) => onChange(cards.filter((_, i) => i !== index));

  const add = () => {
    // A new card inherits the lesson of the one above it: decks are written a
    // lesson at a time, and picking the same lesson twelve times is busywork.
    const last = cards[cards.length - 1];
    onChange([...cards, { ...newSpeakingCard(), lessonId: last?.lessonId }]);
  };

  return (
    <div className="space-y-3">
      {cards.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No cards yet — add the first one.
        </div>
      )}

      {cards.map((card, index) => {
        const incomplete = !card.prompt.trim() || !card.answer.trim();
        return (
          <article key={card.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {index + 1}
                {incomplete && (
                  <span className="ml-2 font-normal text-amber-700">
                    Needs both sides — students won't see it until then
                  </span>
                )}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Listen"
                  disabled={!card.answer.trim()}
                  onClick={() => speak(card.answer)}
                >
                  <Volume2Icon />
                  <span className="sr-only">Listen</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
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
                  title="Delete card"
                  className="text-destructive"
                  onClick={() => remove(index)}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete card</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Como se diz (front)</span>
                <input
                  value={card.prompt}
                  onChange={(e) => update(index, { prompt: e.target.value })}
                  placeholder="Sala de reunião"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>In English (back)</span>
                <input
                  value={card.answer}
                  onChange={(e) => update(index, { answer: e.target.value })}
                  placeholder="Meeting room"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Example</span>
                <input
                  value={card.example ?? ""}
                  onChange={(e) => update(index, { example: e.target.value })}
                  placeholder="Could you tell me where the meeting room is?"
                  className={inputClass}
                />
              </label>
              <label className="block">
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
          </article>
        );
      })}

      <Button variant="outline" className="w-full border-dashed" onClick={add}>
        <PlusIcon />
        Add card
      </Button>
    </div>
  );
}
