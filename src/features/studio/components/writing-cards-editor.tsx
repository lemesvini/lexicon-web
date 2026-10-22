import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClipboardPasteIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LessonCombobox } from "@/components/lesson-combobox";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { newWritingCard, type WritingCard } from "../data/practice";
import { PasteSentencesDialog } from "./paste-sentences-dialog";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * A writing deck: sentences shown in Portuguese, put into English by tapping
 * the English words in order — listening's exercise without the audio, so
 * there is nothing to make but the sentences themselves.
 */
export function WritingCardsEditor({
  cards,
  lessons,
  module,
  onChange,
}: {
  cards: WritingCard[];
  lessons: CloudLessonSummary[];
  module: string;
  onChange: (cards: WritingCard[]) => void;
}) {
  const [pasteOpen, setPasteOpen] = React.useState(false);

  const update = (index: number, patch: Partial<WritingCard>) =>
    onChange(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const add = () => {
    const last = cards[cards.length - 1];
    onChange([...cards, { ...newWritingCard(), lessonId: last?.lessonId }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setPasteOpen(true)}>
          <ClipboardPasteIcon />
          Paste sentences
        </Button>
      </div>

      {cards.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No sentences yet — paste a few, or add the first one.
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
                    Needs both languages — students won't see it until then
                  </span>
                )}
              </span>
              <div className="flex items-center gap-0.5">
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
                  title="Delete sentence"
                  className="text-destructive"
                  onClick={() => onChange(cards.filter((_, i) => i !== index))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete sentence</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Em português (what they see)</span>
                <input
                  value={card.prompt}
                  onChange={(e) => update(index, { prompt: e.target.value })}
                  placeholder="Onde fica a sala de reunião?"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>In English (what they build)</span>
                <input
                  value={card.answer}
                  onChange={(e) => update(index, { answer: e.target.value })}
                  placeholder="Where is the meeting room?"
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
              <label className="block">
                <span className={labelClass}>Extra words (optional, comma-separated)</span>
                <input
                  value={(card.distractors ?? []).join(", ")}
                  onChange={(e) =>
                    update(index, {
                      distractors: e.target.value.split(",").map((word) => word.trimStart()),
                    })
                  }
                  placeholder="when, room, it"
                  className={inputClass}
                />
              </label>
            </div>
          </article>
        );
      })}

      <Button variant="outline" className="w-full border-dashed" onClick={add}>
        <PlusIcon />
        Add sentence
      </Button>

      <PasteSentencesDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        lessons={lessons}
        module={module}
        onAdd={(lines, lessonId) =>
          onChange([
            ...cards,
            ...lines.map((line) => ({
              ...newWritingCard(),
              answer: line.text,
              prompt: line.translation ?? "",
              lessonId: lessonId ?? undefined,
            })),
          ])
        }
      />
    </div>
  );
}
