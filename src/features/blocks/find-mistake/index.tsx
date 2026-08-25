import { SearchXIcon } from "lucide-react";
import type { FindMistakeBlock } from "@/lib/lessons";
import type {
  BlockAnswerProps,
  BlockDefinition,
  BlockViewProps,
} from "../types";
import type { OptionState } from "../exercise-ui";
import { newBlockId } from "../block-id";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";
import { WordChip, optionState } from "../exercise-ui";

/**
 * Splits the sentence into the tokens the answer indexes.
 *
 * Whitespace only: punctuation stays attached to its word, so the index counts
 * the same things the reader sees as words. Runs of whitespace collapse rather
 * than yielding an empty token, which would shift every answer after it the
 * first time an author double-spaced a sentence.
 */
export function words(sentence: string): string[] {
  return sentence.split(/\s+/).filter((w) => w !== "");
}

/**
 * The sentence, one chip per word.
 *
 * How a word is standing is the caller's to say rather than derived here: the
 * student's copy speaks the shared chosen/right/wrong vocabulary, while the
 * teacher's answer key means something else entirely by the marked word — that
 * is the broken one, not the won one.
 */
function Sentence({
  sentence,
  stateOf,
  onPick,
  disabled,
}: {
  sentence: string;
  stateOf: (index: number) => OptionState;
  onPick?: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-xl leading-loose">
      {words(sentence).map((word, i) => (
        <WordChip
          key={i}
          state={stateOf(i)}
          disabled={disabled}
          onClick={onPick && (() => onPick(i))}
        >
          {word}
        </WordChip>
      ))}
    </p>
  );
}

function View({ block, audience }: BlockViewProps<FindMistakeBlock>) {
  // The teacher's surfaces get the key; the student's copy doesn't carry one to
  // show (`strip_answer_keys` drops it), so this is belt and braces.
  const showKey = audience === "teacher" && block.answer !== undefined;
  const answer = block.answer ?? null;

  return (
    <section className="space-y-4">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      {/* The key word is marked "incorrect": it is the wrong word, and a green
          highlight over the mistake is the one thing a teacher reading their own
          answer key must not see. */}
      <Sentence
        sentence={block.sentence}
        stateOf={(i) => (showKey && i === answer ? "incorrect" : "idle")}
        disabled
      />

      {showKey && answer !== null && (
        <p className="text-sm text-muted-foreground">
          Mistake: <strong>{words(block.sentence)[answer] ?? "—"}</strong>
        </p>
      )}

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
}: BlockAnswerProps<FindMistakeBlock>) {
  const chosen = typeof value === "number" ? value : null;
  const key = typeof correct === "number" ? correct : null;

  return (
    <section className="space-y-5">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        One word is wrong — click it
      </p>

      <Sentence
        sentence={block.sentence}
        stateOf={(i) =>
          optionState({ index: i, chosen, correct: key, revealed: key !== null })
        }
        onPick={disabled ? undefined : onChange}
        disabled={disabled}
      />

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: FindMistakeBlock;
  onChange: (b: FindMistakeBlock) => void;
}) {
  const tokens = words(block.sentence);

  const setSentence = (sentence: string) => {
    // The key is a position in the word list, so a rewrite that shortens the
    // sentence can leave it pointing past the end. Clearing it there costs the
    // author one click; keeping it would export a question nobody can pass.
    const answer =
      block.answer !== undefined && block.answer < words(sentence).length
        ? block.answer
        : undefined;
    onChange({ ...block, sentence, answer });
  };

  return (
    <div className="space-y-3">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <AutoTextarea
        value={block.sentence}
        onValueChange={setSentence}
        placeholder="She go to school every day."
        className="rounded-md border bg-background px-3 py-1.5 text-base"
      />

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Click the word that is wrong
        </p>
        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Write the sentence first — every word in it becomes clickable.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-base">
            {tokens.map((word, i) => (
              <WordChip
                key={i}
                state={block.answer === i ? "incorrect" : "idle"}
                onClick={() => onChange({ ...block, answer: i })}
              >
                {word}
              </WordChip>
            ))}
          </p>
        )}
        {block.answer === undefined && tokens.length > 0 && (
          <p className="text-xs text-destructive">
            No mistake marked — this question can't be corrected.
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

export const findMistakeBlock: BlockDefinition<FindMistakeBlock> = {
  meta: {
    type: "find-mistake",
    label: "Find the mistake",
    hint: "One wrong word in a sentence, found by clicking it",
    icon: SearchXIcon,
  },
  create: () => ({
    type: "find-mistake",
    id: newBlockId(),
    sentence: "",
  }),
  View,
  Editor,
  Answer,
};
