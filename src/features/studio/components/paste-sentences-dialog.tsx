import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LessonCombobox } from "@/components/lesson-combobox";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

// Sentences pasted in bulk, for the listening and writing decks: the same list
// — written by hand, or by an LLM from a lesson — serves both.

/**
 * Parses pasted sentences, one per line: the English, then optionally a `|` or
 * a tab and the Portuguese. Blank lines are skipped.
 */
function parsePasted(text: string): { text: string; translation?: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [english, portuguese] = line.split(/\s*\|\s*|\t+/);
      return { text: english!.trim(), translation: portuguese?.trim() || undefined };
    })
    .filter((line) => line.text);
}

export function PasteSentencesDialog({
  open,
  onOpenChange,
  lessons,
  module,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessons: CloudLessonSummary[];
  module: string;
  onAdd: (lines: { text: string; translation?: string }[], lessonId: string | null) => void;
}) {
  const [text, setText] = React.useState("");
  const [lessonId, setLessonId] = React.useState<string | null>(null);
  const lines = parsePasted(text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste sentences</DialogTitle>
          <DialogDescription>
            One per line. Add the Portuguese after a <code>|</code> (or a tab, pasting from
            a spreadsheet): <code>Could you open the window? | Você poderia abrir a janela?</code>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            placeholder={"Where is the meeting room? | Onde fica a sala de reunião?\nI'll call you back later. | Eu te ligo depois."}
            className={`${inputClass} font-mono text-xs`}
          />
          <label className="block">
            <span className={labelClass}>From lesson (all of them)</span>
            <LessonCombobox
              lessons={lessons}
              module={module}
              value={lessonId}
              onChange={setLessonId}
              allowNone
              noneLabel="No lesson — always available"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={lines.length === 0}
              onClick={() => {
                onAdd(lines, lessonId);
                setText("");
                onOpenChange(false);
              }}
            >
              Add {lines.length || ""} sentence{lines.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
