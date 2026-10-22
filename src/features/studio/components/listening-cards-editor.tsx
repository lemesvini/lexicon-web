import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClipboardPasteIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LessonCombobox } from "@/components/lesson-combobox";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { PasteSentencesDialog } from "./paste-sentences-dialog";
import {
  audioIsCurrent,
  generatePracticeAudio,
  listPracticeVoices,
  newListeningCard,
  practiceAudioUrl,
  type ListeningCard,
  type PracticeVoice,
} from "../data/practice";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const triggerClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm data-[size=default]:h-auto shadow-none dark:bg-background dark:hover:bg-background";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

type Deck = { voiceId?: string; cards: ListeningCard[] };

/** One audio at a time: starting another stops the last. */
let playing: HTMLAudioElement | null = null;
function play(path: string) {
  playing?.pause();
  playing = new Audio(practiceAudioUrl(path));
  void playing.play();
}

/**
 * A listening deck: sentences, each spoken by an ElevenLabs voice and stored
 * with the card. The student hears one and rebuilds it from its words.
 *
 * Audio is made here, a sentence at a time or every missing one at once, and
 * the activity is saved straight after — a file made and not saved would be
 * paid for and lost.
 */
export function ListeningCardsEditor({
  deck,
  lessons,
  module,
  activityId,
  canGenerate,
  onChange,
  onPersist,
}: {
  deck: Deck;
  lessons: CloudLessonSummary[];
  module: string;
  /** The activity's slug — the folder its audio is stored under. */
  activityId: string;
  /** False until the activity has an id and a module, so it can be saved. */
  canGenerate: boolean;
  onChange: (deck: Deck) => void;
  /** Saves the activity with this deck; called after audio is made. */
  onPersist: (deck: Deck) => Promise<void>;
}) {
  const [voices, setVoices] = React.useState<PracticeVoice[] | null>(null);
  const [voicesError, setVoicesError] = React.useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  /** Cards whose audio is being made right now. */
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  // The deck as of the last change, for the generation loop: each file made
  // lands on the latest cards, not on the ones it started from.
  const latest = React.useRef(deck);
  React.useEffect(() => {
    latest.current = deck;
  }, [deck]);

  React.useEffect(() => {
    let cancelled = false;
    listPracticeVoices()
      .then((list) => !cancelled && setVoices(list))
      .catch((err: Error) => !cancelled && setVoicesError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const { cards, voiceId } = deck;

  const setCards = (next: ListeningCard[]) => onChange({ ...deck, cards: next });
  const update = (index: number, patch: Partial<ListeningCard>) =>
    setCards(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setCards(next);
  };

  const add = () => {
    const last = cards[cards.length - 1];
    setCards([...cards, { ...newListeningCard(), lessonId: last?.lessonId }]);
  };

  const pending = cards.filter((card) => card.text.trim() && !audioIsCurrent(card, voiceId));

  /** Makes the audio for these cards, one after another, then saves. */
  const generate = async (ids: string[]) => {
    if (!voiceId || ids.length === 0) return;
    setError(null);
    setBusy(new Set(ids));
    let failed = 0;
    for (const id of ids) {
      const card = latest.current.cards.find((c) => c.id === id);
      if (!card?.text.trim()) continue;
      const text = card.text.trim();
      try {
        const path = await generatePracticeAudio({
          activityId,
          cardId: card.id,
          text,
          voiceId,
          previousPath: card.audioPath,
        });
        const next = {
          ...latest.current,
          cards: latest.current.cards.map((c) =>
            c.id === id ? { ...c, audioPath: path, audioText: text, voiceId } : c,
          ),
        };
        latest.current = next;
        onChange(next);
      } catch (err) {
        failed++;
        setError((err as Error).message);
      }
      setBusy((current) => {
        const rest = new Set(current);
        rest.delete(id);
        return rest;
      });
    }
    try {
      await onPersist(latest.current);
    } catch (err) {
      setError(`The audio was made but the activity wasn't saved: ${(err as Error).message}`);
    }
    if (failed > 0 && ids.length > 1) {
      setError((last) => `${failed} of ${ids.length} failed. Last error: ${last}`);
    }
  };

  const generating = busy.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <label className="block min-w-56 flex-1">
          <span className={labelClass}>Voice (ElevenLabs)</span>
          {voicesError ? (
            <p className="text-sm text-destructive">{voicesError}</p>
          ) : (
            <Select
              value={voiceId}
              onValueChange={(id) => onChange({ ...deck, voiceId: id })}
              disabled={!voices}
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder={voices ? "Pick a voice" : "Loading voices…"} />
              </SelectTrigger>
              <SelectContent>
                {(voices ?? []).map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.description && (
                      <span className="text-muted-foreground"> — {voice.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>
        <Button variant="outline" onClick={() => setPasteOpen(true)}>
          <ClipboardPasteIcon />
          Paste sentences
        </Button>
        <Button
          onClick={() => void generate(pending.map((card) => card.id))}
          disabled={!canGenerate || !voiceId || pending.length === 0 || generating}
          title={
            !canGenerate
              ? "Give the activity an id and a module first — it is saved after"
              : !voiceId
                ? "Pick a voice first"
                : undefined
          }
        >
          {generating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {generating
            ? `Making audio… ${busy.size} left`
            : `Make missing audio${pending.length ? ` (${pending.length})` : ""}`}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {cards.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No sentences yet — paste a few, or add the first one.
        </div>
      )}

      {cards.map((card, index) => {
        const current = audioIsCurrent(card, voiceId);
        const working = busy.has(card.id);
        return (
          <article key={card.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-muted-foreground">
                {index + 1}
                {working ? (
                  <Badge variant="outline" className="gap-1">
                    <Loader2Icon className="animate-spin" />
                    Making audio
                  </Badge>
                ) : current ? (
                  <Badge variant="secondary">Audio ready</Badge>
                ) : card.audioPath ? (
                  <Badge variant="outline" className="border-amber-600/40 text-amber-700">
                    Audio out of date
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    No audio — students won't see it
                  </Badge>
                )}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Play"
                  disabled={!card.audioPath}
                  onClick={() => card.audioPath && play(card.audioPath)}
                >
                  <PlayIcon />
                  <span className="sr-only">Play</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={current ? "Make it again" : "Make audio"}
                  disabled={!canGenerate || !voiceId || !card.text.trim() || generating}
                  onClick={() => void generate([card.id])}
                >
                  <SparklesIcon />
                  <span className="sr-only">Make audio</span>
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
                  title="Delete sentence"
                  className="text-destructive"
                  onClick={() => setCards(cards.filter((_, i) => i !== index))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete sentence</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>Sentence (what they hear)</span>
                <input
                  value={card.text}
                  onChange={(e) => update(index, { text: e.target.value })}
                  placeholder="Could you tell me where the meeting room is?"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Tradução</span>
                <input
                  value={card.translation ?? ""}
                  onChange={(e) => update(index, { translation: e.target.value })}
                  placeholder="Você poderia me dizer onde fica a sala de reunião?"
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
              <label className="block sm:col-span-2">
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
                <span className="mt-1 block text-xs text-muted-foreground">
                  Words that aren't in the sentence, mixed in with its own. Left empty, the app
                  borrows a few from the other sentences.
                </span>
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
          setCards([
            ...cards,
            ...lines.map((line) => ({
              ...newListeningCard(),
              text: line.text,
              translation: line.translation,
              lessonId: lessonId ?? undefined,
            })),
          ])
        }
      />
    </div>
  );
}
