import { TextSelectIcon } from "lucide-react";
import type { ChooseDescriptionBlock } from "@/lib/lessons";
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
import { AnswerKeyMark, OptionButton, optionState } from "../exercise-ui";

/** The passage itself — set apart from the options, because reading it and
 *  choosing between them are two different acts. */
function Passage({ text }: { text: string }) {
  return (
    <blockquote className="rounded-xl border-l-4 border-primary/50 bg-muted/40 px-5 py-4 text-lg leading-relaxed">
      {renderInline(text)}
    </blockquote>
  );
}

function View({ block, audience }: BlockViewProps<ChooseDescriptionBlock>) {
  const showKey = audience === "teacher" && block.answer !== undefined;

  return (
    <section className="space-y-4">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <Passage text={block.text} />

      <ul className="space-y-2">
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
}: BlockAnswerProps<ChooseDescriptionBlock>) {
  const chosen = typeof value === "number" ? value : null;
  const key = typeof correct === "number" ? correct : null;
  const revealed = key !== null;

  return (
    <section className="space-y-4">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <Passage text={block.text} />

      <ul className="space-y-2">
        {block.options.map((option, i) => (
          <li key={i}>
            <OptionButton
              state={optionState({ index: i, chosen, correct: key, revealed })}
              disabled={disabled}
              onClick={() => onChange(i)}
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
  block: ChooseDescriptionBlock;
  onChange: (b: ChooseDescriptionBlock) => void;
}) {
  const setOption = (i: number, value: string) => {
    const options = block.options.slice();
    options[i] = value;
    onChange({ ...block, options });
  };

  const removeOption = (i: number) => {
    const options = block.options.filter((_, idx) => idx !== i);
    const answer =
      block.answer === undefined || block.answer === i
        ? undefined
        : block.answer > i
          ? block.answer - 1
          : block.answer;
    onChange({ ...block, options, answer });
  };

  return (
    <div className="space-y-3">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <AutoTextarea
        value={block.text}
        onValueChange={(text) => onChange({ ...block, text })}
        placeholder="The English text the student reads…"
        className="rounded-md border bg-background px-3 py-1.5 text-base"
      />

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Descriptions — click the circle to mark the right one
        </p>
        {block.options.map((option, i) => (
          <div key={i} className="group/row flex items-start gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...block, answer: i })}
              aria-label={`Mark description ${i + 1} as correct`}
              className="mt-1.5"
            >
              <AnswerKeyMark isAnswer={block.answer === i} />
            </button>
            <AutoTextarea
              value={option}
              onValueChange={(v) => setOption(i, v)}
              placeholder={`Description ${i + 1}`}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            />
            <span className="mt-1 opacity-0 transition-opacity group-hover/row:opacity-100">
              <DeleteRowButton
                onClick={() => removeOption(i)}
                label="Remove description"
              />
            </span>
          </div>
        ))}
        <AddRowButton
          onClick={() => onChange({ ...block, options: [...block.options, ""] })}
          label="Add description"
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

export const chooseDescriptionBlock: BlockDefinition<ChooseDescriptionBlock> = {
  meta: {
    type: "choose-description",
    label: "Choose the description",
    hint: "A passage, and descriptions to pick between",
    icon: TextSelectIcon,
  },
  create: () => ({
    type: "choose-description",
    id: newBlockId(),
    text: "",
    options: ["", "", ""],
  }),
  View,
  Editor,
  Answer,
};
