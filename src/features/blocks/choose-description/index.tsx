import { TextSelectIcon } from "lucide-react";
import type { ChooseDescriptionBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockAnswerProps, BlockDefinition, BlockViewProps } from "../types";
import { newBlockId } from "../block-id";
import { Markdown } from "../markdown";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  NoteInput,
} from "../editor-ui/primitives";
import { AnswerKeyMark, OptionButton, optionState } from "../exercise-ui";

/** Monospace treatment for the passage. Slightly smaller because Monaco runs
 *  wide, so matched point sizes read as a jump in scale. */
const MONO_CLASS = "font-mono text-[0.9em]";

/** The passage itself — set apart from the options, because reading it and
 *  choosing between them are two different acts.
 *
 *  Rendered as markdown rather than as one run of text: an email has a greeting,
 *  a body and a sign-off, and where the author broke the lines is part of what
 *  the student is being asked to read. */
function Passage({ block }: { block: ChooseDescriptionBlock }) {
  return (
    <blockquote
      className={cn(
        "rounded-xl border-l-4 border-primary/50 bg-muted/40 px-5 py-4 text-lg leading-relaxed",
        block.font === "mono" && MONO_CLASS,
      )}
    >
      <Markdown text={block.text} />
    </blockquote>
  );
}

function View({ block, audience }: BlockViewProps<ChooseDescriptionBlock>) {
  const showKey = audience === "teacher" && block.answer !== undefined;

  return (
    <section className="space-y-4">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <Passage block={block} />

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

      <Passage block={block} />

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

/** Sans or mono for the passage — a two-state segmented control, set in the
 *  face it selects so the choice is legible as itself. */
function FontToggle({
  value,
  onChange,
}: {
  value: "sans" | "mono";
  onChange: (font: "sans" | "mono") => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {(["sans", "mono"] as const).map((font) => (
        <button
          key={font}
          type="button"
          onClick={() => onChange(font)}
          aria-pressed={value === font}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
            font === "mono" && "font-mono",
            value === font
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {font}
        </button>
      ))}
    </div>
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Passage — markdown
          </p>
          <FontToggle
            value={block.font ?? "sans"}
            onChange={(font) =>
              onChange({ ...block, font: font === "sans" ? undefined : font })
            }
          />
        </div>
        <AutoTextarea
          value={block.text}
          onValueChange={(text) => onChange({ ...block, text })}
          placeholder="The English text the student reads… blank lines, line breaks and lists are kept"
          className={cn(
            "rounded-md border bg-background px-3 py-1.5 text-base",
            block.font === "mono" && MONO_CLASS,
          )}
        />
      </div>

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
