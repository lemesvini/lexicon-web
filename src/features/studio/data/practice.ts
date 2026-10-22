// Admin-side access to practice activities.
//
// A practice activity belongs to a module and a skill, not to a lesson: it
// gathers cards from many lessons, and each card names its own (see
// supabase/migrations/0031_practice.sql). The module is a real foreign key to
// `modules.id` — unlike a lesson's, which is matched by name.
//
// All four skills are authored here. Every document is a deck of cards — what
// a card holds is the skill's (see 0031–0034).

import { supabase } from "@/lib/supabase";
import { newBlockId } from "@/features/blocks/block-id";
import { toPublishStatus, type PublishStatus } from "./publishing";

/** `practice_activities.skill`, with what the Studio calls it and whether its
 *  editor exists yet. */
export const PRACTICE_SKILLS = [
  { value: "speaking", label: "Speaking", ready: true },
  { value: "listening", label: "Listening", ready: true },
  { value: "reading", label: "Reading", ready: true },
  { value: "writing", label: "Writing", ready: true },
] as const;

export type PracticeSkill = (typeof PRACTICE_SKILLS)[number]["value"];

export function practiceSkillLabel(skill: PracticeSkill): string {
  return PRACTICE_SKILLS.find((s) => s.value === skill)?.label ?? skill;
}

function toSkill(raw: unknown): PracticeSkill {
  return PRACTICE_SKILLS.some((s) => s.value === raw)
    ? (raw as PracticeSkill)
    : "speaking";
}

/**
 * One speaking card: what to say, in Portuguese, and how it is said.
 *
 * `id` is minted when the card is added and never changes — progress is kept
 * per card, so an id that moved with the card's position would scramble every
 * student's progress the first time the deck was reordered.
 */
export type SpeakingCard = {
  id: string;
  /** The front, in Portuguese: "Sala de reunião". */
  prompt: string;
  /** The back, in English: "Meeting room". */
  answer: string;
  /** The answer in a sentence: "Could you tell me where the meeting room is?" */
  example?: string;
  /** The lesson it comes from. Students only get it once their group has had
   *  that class; without one, it is always out. */
  lessonId?: string;
};

/**
 * One listening sentence: heard, then rebuilt from its words.
 *
 * The audio is made from `text` with ElevenLabs (the `practice-audio` Edge
 * Function) and stored in the `practice-audio` bucket; `audioText` and
 * `voiceId` record what it was made from, so a sentence edited since — or a
 * voice changed — shows its audio as out of date.
 */
export type ListeningCard = {
  id: string;
  /** The sentence, in English. */
  text: string;
  /** In Portuguese, shown once it has been answered. */
  translation?: string;
  lessonId?: string;
  audioPath?: string;
  audioText?: string;
  voiceId?: string;
  /** Words not in the sentence, offered among its own. Optional: the app
   *  borrows some from the other sentences when there are none. */
  distractors?: string[];
};

/**
 * One writing sentence: shown in Portuguese, put into English by tapping its
 * words in order — listening without the audio (0033).
 */
export type WritingCard = {
  id: string;
  /** In Portuguese — what the student sees. */
  prompt: string;
  /** In English — what they build. */
  answer: string;
  lessonId?: string;
  /** As a listening card's: words not in the answer, mixed in with its own. */
  distractors?: string[];
};

export type ReadingQuestion = {
  id: string;
  prompt: string;
  options: string[];
  /** 0-based index into `options` — the homework blocks' convention. */
  answer: number;
};

/**
 * One reading text and its questions — the shape of the web's reading library
 * (`@/features/practice/data/readings`). The text is one card to the spaced
 * repetition; its questions are asked one by one after it.
 */
export type ReadingText = {
  id: string;
  /** In English, like the text. */
  title: string;
  /** CEFR level, shown on the text: "A1". */
  level?: string;
  /** One Portuguese line under the title. */
  blurb?: string;
  lessonId?: string;
  /** One string per paragraph. */
  paragraphs: string[];
  questions: ReadingQuestion[];
};

/** An activity's cards, by its skill. */
export type PracticeContent =
  | { skill: "speaking"; cards: SpeakingCard[] }
  | { skill: "listening"; voiceId?: string; cards: ListeningCard[] }
  /** The skills with no editor yet: whatever is stored is left alone. */
  | { skill: "writing"; cards: WritingCard[] }
  | { skill: "reading"; cards: ReadingText[] };

export function newSpeakingCard(): SpeakingCard {
  return { id: newBlockId(), prompt: "", answer: "" };
}

export function newReadingQuestion(): ReadingQuestion {
  return { id: newBlockId(), prompt: "", options: ["", "", ""], answer: 0 };
}

export function newReadingText(): ReadingText {
  return { id: newBlockId(), title: "", paragraphs: [], questions: [newReadingQuestion()] };
}

export function newWritingCard(): WritingCard {
  return { id: newBlockId(), prompt: "", answer: "" };
}

export function newListeningCard(): ListeningCard {
  return { id: newBlockId(), text: "" };
}

export function emptyContent(skill: PracticeSkill): PracticeContent {
  // Every variant starts as an empty deck; the cast is TypeScript not narrowing
  // a union from a variable.
  return { skill, cards: [] } as PracticeContent;
}

/** Whether a listening card's audio was made from what it says now, in the
 *  voice it should have. */
export function audioIsCurrent(card: ListeningCard, voiceId: string | undefined): boolean {
  return (
    !!card.audioPath &&
    card.audioText === card.text.trim() &&
    (!voiceId || card.voiceId === voiceId)
  );
}

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/** Whatever came out of the column, as a deck — anything that isn't a card with
 *  an id is dropped rather than shown as an empty row that can't be saved. */
function toContent(skill: PracticeSkill, raw: unknown): PracticeContent {
  const doc = (raw ?? {}) as { cards?: unknown; voiceId?: unknown };
  const cards = (Array.isArray(doc.cards) ? doc.cards : []).filter(
    (card): card is Record<string, unknown> =>
      !!card && typeof card === "object" && typeof (card as { id?: unknown }).id === "string",
  );

  if (skill === "speaking") {
    return {
      skill,
      cards: cards.map((c) => ({
        id: c.id as string,
        prompt: str(c.prompt) ?? "",
        answer: str(c.answer) ?? "",
        example: str(c.example),
        lessonId: str(c.lessonId),
      })),
    };
  }

  const distractorsOf = (c: Record<string, unknown>) =>
    Array.isArray(c.distractors)
      ? c.distractors.filter((d): d is string => typeof d === "string" && !!d.trim())
      : undefined;

  if (skill === "reading") {
    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    return {
      skill,
      cards: cards.map((c) => ({
        id: c.id as string,
        title: str(c.title) ?? "",
        level: str(c.level),
        blurb: str(c.blurb),
        lessonId: str(c.lessonId),
        paragraphs: strings(c.paragraphs),
        questions: (Array.isArray(c.questions) ? c.questions : [])
          .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
          .map((q) => ({
            id: str(q.id) ?? newBlockId(),
            prompt: str(q.prompt) ?? "",
            options: strings(q.options),
            answer: typeof q.answer === "number" ? q.answer : 0,
          })),
      })),
    };
  }

  if (skill === "writing") {
    return {
      skill,
      cards: cards.map((c) => ({
        id: c.id as string,
        prompt: str(c.prompt) ?? "",
        answer: str(c.answer) ?? "",
        lessonId: str(c.lessonId),
        distractors: distractorsOf(c),
      })),
    };
  }

  if (skill === "listening") {
    return {
      skill,
      voiceId: str(doc.voiceId),
      cards: cards.map((c) => ({
        id: c.id as string,
        text: str(c.text) ?? "",
        translation: str(c.translation),
        lessonId: str(c.lessonId),
        audioPath: str(c.audioPath),
        audioText: str(c.audioText),
        voiceId: str(c.voiceId),
        distractors: distractorsOf(c),
      })),
    };
  }

  return { skill, cards: [] };
}

/** The deck as it is stored: blank optional fields left out, not saved as "". */
function toDocument(content: PracticeContent): Record<string, unknown> {
  const optional = (key: string, value: string | undefined) =>
    value?.trim() ? { [key]: value.trim() } : {};

  if (content.skill === "speaking") {
    return {
      cards: content.cards.map((card) => ({
        id: card.id,
        prompt: card.prompt.trim(),
        answer: card.answer.trim(),
        ...optional("example", card.example),
        ...optional("lessonId", card.lessonId),
      })),
    };
  }

  const distractorsField = (distractors: string[] | undefined) => {
    const words = (distractors ?? []).map((d) => d.trim()).filter(Boolean);
    return words.length > 0 ? { distractors: words } : {};
  };

  if (content.skill === "reading") {
    return {
      cards: content.cards.map((card) => ({
        id: card.id,
        title: card.title.trim(),
        ...optional("level", card.level),
        ...optional("blurb", card.blurb),
        ...optional("lessonId", card.lessonId),
        paragraphs: card.paragraphs.map((p) => p.trim()).filter(Boolean),
        // Kept as written, half-finished ones too, so a draft survives a save;
        // the app skips a question without a prompt or two options.
        questions: card.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt.trim(),
          options: question.options.map((option) => option.trim()),
          answer: question.answer,
        })),
      })),
    };
  }

  if (content.skill === "writing") {
    return {
      cards: content.cards.map((card) => ({
        id: card.id,
        prompt: card.prompt.trim(),
        answer: card.answer.trim(),
        ...optional("lessonId", card.lessonId),
        ...distractorsField(card.distractors),
      })),
    };
  }

  if (content.skill === "listening") {
    return {
      ...optional("voiceId", content.voiceId),
      cards: content.cards.map((card) => ({
        id: card.id,
        text: card.text.trim(),
        ...optional("translation", card.translation),
        ...optional("lessonId", card.lessonId),
        ...optional("audioPath", card.audioPath),
        ...optional("audioText", card.audioText),
        ...optional("voiceId", card.voiceId),
        ...distractorsField(card.distractors),
      })),
    };
  }

  return { cards: [] };
}

export type PracticeModule = { id: string; name: string };

/** Every module, in curriculum order — what an activity can be filed under. */
export async function listPracticeModules(): Promise<PracticeModule[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("id, name")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id as string, name: (row.name as string) ?? "" }));
}

export type PracticeSummary = {
  id: string;
  title: string;
  moduleId: string;
  skill: PracticeSkill;
  position: number;
  cardCount: number;
  status: PublishStatus;
  updatedAt: string;
};

export async function listPracticeActivities(): Promise<PracticeSummary[]> {
  const { data, error } = await supabase
    .from("practice_activities")
    .select("id, title, module_id, skill, position, status, updated_at, cards:document->cards")
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? "",
    moduleId: row.module_id as string,
    skill: toSkill(row.skill),
    position: (row.position as number | null) ?? 0,
    cardCount: Array.isArray(row.cards) ? row.cards.length : 0,
    status: toPublishStatus(row.status),
    updatedAt: (row.updated_at as string | null) ?? "",
  }));
}

export type PracticeActivity = Omit<PracticeSummary, "cardCount"> & {
  content: PracticeContent;
};

export async function fetchPracticeActivity(id: string): Promise<PracticeActivity | null> {
  const { data, error } = await supabase
    .from("practice_activities")
    .select("id, title, module_id, skill, position, status, document, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const skill = toSkill(data.skill);
  return {
    id: data.id as string,
    title: (data.title as string | null) ?? "",
    moduleId: data.module_id as string,
    skill,
    position: (data.position as number | null) ?? 0,
    status: toPublishStatus(data.status),
    content: toContent(skill, data.document),
    updatedAt: (data.updated_at as string | null) ?? "",
  };
}

/**
 * Writes an activity, creating it on first save — the same upsert on its slug
 * homework has, and for the same reason `status` stays out of it: editing a
 * published activity must not silently retract it.
 */
export async function savePracticeActivity(input: {
  id: string;
  title: string;
  moduleId: string;
  position: number;
  content: PracticeContent;
}): Promise<void> {
  const { error } = await supabase.from("practice_activities").upsert(
    {
      id: input.id,
      title: input.title,
      module_id: input.moduleId,
      skill: input.content.skill,
      position: input.position,
      document: toDocument(input.content),
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}

export async function setPracticeStatus(id: string, status: PublishStatus): Promise<void> {
  const { error } = await supabase
    .from("practice_activities")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deletePracticeActivity(id: string): Promise<void> {
  const { error } = await supabase.from("practice_activities").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

// ── Listening audio ──────────────────────────────────────────────────────────

const AUDIO_BUCKET = "practice-audio";

export function practiceAudioUrl(path: string): string {
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type PracticeVoice = { id: string; name: string; description: string };

/**
 * Pulls the real reason out of a failed function call — supabase-js reports
 * any non-2xx as one flat message and keeps the body on `context`. The same
 * helper the teachers' and students' data files have.
 */
async function edgeErrorMessage(error: unknown): Promise<string> {
  const response = (error as { context?: Response }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Not JSON — fall through to the generic message.
    }
  }
  return (error as Error).message ?? "Something went wrong.";
}

/** The ElevenLabs voices on the account. */
export async function listPracticeVoices(): Promise<PracticeVoice[]> {
  const { data, error } = await supabase.functions.invoke<{ voices: PracticeVoice[] }>(
    "practice-audio",
    { body: { action: "voices" } },
  );
  if (error) throw new Error(await edgeErrorMessage(error));
  return data?.voices ?? [];
}

/** Speaks a sentence in a voice, stores it, and returns the object path. The
 *  file it replaces, if any, is removed. */
export async function generatePracticeAudio(input: {
  activityId: string;
  cardId: string;
  text: string;
  voiceId: string;
  previousPath?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ path: string }>("practice-audio", {
    body: { action: "generate", ...input },
  });
  if (error) throw new Error(await edgeErrorMessage(error));
  if (!data?.path) throw new Error("No audio came back.");
  return data.path;
}
