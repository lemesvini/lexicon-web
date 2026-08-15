import { SquareDashedBottomCodeIcon } from "lucide-react";
import { SENTENCE_BLANK, type FinishSentenceBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockAnswerProps, BlockDefinition, BlockViewProps } from "../types";
import { newBlockId } from "../block-id";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  NoteInput,
} from "../editor-ui/primitives";
import {
  AnswerKeyMark,
  OptionButton,
  SentenceSlot,
  optionState,
} from "../exercise-ui";

/**
 * Splits the sentence around its gap.
 *
 * Only the first `___` is a gap; any others stay as literal text. One gap per
 * sentence keeps the answer a single index, which is what the whole submission
 * format rests on — and a sentence needing two gaps is really two questions.
 */
function split(sentence: string): { before: string; after: string } {
  const at = sentence.indexOf(SENTENCE_BLANK);
  if (at === -1) return { before: sentence, after: "" };
  return {
    before: sentence.slice(0, at),
    after: sentence.slice(at + SENTENCE_BLANK.length),
  };
}

function Sentence({
  block,
  slot,
}: {
  block: FinishSentenceBlock;
  slot: React.ReactNode;
}) {
  const { before, after } = split(block.sentence);
  return (
    <p className="text-xl leading-loose">
      {renderInline(before)}
      {slot}
      {renderInline(after)}
    </p>
  );
}

function View({ block, audience }: BlockViewProps<FinishSentenceBlock>) {
  // The teacher's surfaces get the key; the student's copy doesn't carry one to
  // show (`student_homework` strips it), so this is belt and braces.
  const showKey = audience === "teacher" && block.answer !== undefined;

  return (
    <section className="space-y-4">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <Sentence block={block} slot={<SentenceSlot word={null} state="idle" />} />

      <ul className="grid gap-2 sm:grid-cols-2">
        {block.options.map((option, i) => (
          <li key={i} className="flex items-center gap-2">
            {showKey && <AnswerKeyMark isAnswer={i === block.answer} />}
            <span className="flex-1 rounded-xl border-2 px-4 py-2.5 text-base">
              {option}
            </span>
          </li>
        ))}
      </ul>

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Answer({
  block,
  value,
  onChange,
  disabled,
  correct,
}: BlockAnswerProps<FinishSentenceBlock>) {
  const chosen = typeof value === "number" ? value : null;
  const key = typeof correct === "number" ? correct : null;
  const revealed = key !== null;

  const slotState = optionState({
    index: chosen ?? -1,
    chosen,
    correct: key,
    revealed,
  });

  return (
    <section className="space-y-5">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <Sentence
        block={block}
        slot={
          <SentenceSlot
            word={chosen === null ? null : (block.options[chosen] ?? null)}
            state={slotState}
          />
        }
      />

      <ul className="grid gap-2 sm:grid-cols-2">
        {block.options.map((option, i) => (
          <li key={i}>
            <OptionButton
              state={optionState({ index: i, chosen, correct: key, revealed })}
              disabled={disabled}
              onClick={() => onChange(i)}
              className={cn(chosen === i && !revealed && "font-medium")}
            >
              {option}
            </OptionButton>
          </li>
        ))}
      </ul>

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: FinishSentenceBlock;
  onChange: (b: FinishSentenceBlock) => void;
}) {
  const setOption = (i: number, value: string) => {
    const options = block.options.slice();
    options[i] = value;
    onChange({ ...block, options });
  };

  const removeOption = (i: number) => {
    const options = block.options.filter((_, idx) => idx !== i);
    // The key is an index into the list, so removing an option above it shifts
    // it; removing the answer itself leaves the question without one.
    const answer =
      block.answer === undefined || block.answer === i
        ? undefined
        : block.answer > i
          ? block.answer - 1
          : block.answer;
    onChange({ ...block, options, answer });
  };

  const hasBlank = block.sentence.includes(SENTENCE_BLANK);

  return (
    <div className="space-y-3">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <div className="space-y-1">
        <AutoTextarea
          value={block.sentence}
          onValueChange={(sentence) => onChange({ ...block, sentence })}
          placeholder={`I ${SENTENCE_BLANK} to school every day.`}
          className="rounded-md border bg-background px-3 py-1.5 text-base"
        />
        {!hasBlank && (
          <p className="text-xs text-muted-foreground">
            Put <code className="font-mono">{SENTENCE_BLANK}</code> where the
            missing word goes — without it the gap lands at the end.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Options — click the circle to mark the right one
        </p>
        {block.options.map((option, i) => (
          <div key={i} className="group/row flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...block, answer: i })}
              aria-label={`Mark option ${i + 1} as correct`}
            >
              <AnswerKeyMark isAnswer={block.answer === i} />
            </button>
            <input
              value={option}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <span className="opacity-0 transition-opacity group-hover/row:opacity-100">
              <DeleteRowButton
                onClick={() => removeOption(i)}
                label="Remove option"
              />
            </span>
          </div>
        ))}
        <AddRowButton
          onClick={() => onChange({ ...block, options: [...block.options, ""] })}
          label="Add option"
        />
        {block.answer === undefined && (
          <p className="text-xs text-destructive">
            No right answer marked — this question can't be corrected.
          </p>
        )}
      </div>

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const finishSentenceBlock: BlockDefinition<FinishSentenceBlock> = {
  meta: {
    type: "finish-sentence",
    label: "Finish the sentence",
    hint: "A gap to fill from a few options",
    icon: SquareDashedBottomCodeIcon,
  },
  create: () => ({
    type: "finish-sentence",
    id: newBlockId(),
    sentence: "",
    options: ["", "", "", ""],
  }),
  View,
  Editor,
  Answer,
};
