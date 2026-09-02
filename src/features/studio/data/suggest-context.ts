// Asking Claude for advanced context, watching it think, and refusing anything it
// gets wrong.
//
// The validation below is not belt-and-braces. `parseLesson` checks that a
// document is an object with a `slides` array and nothing else (see ../model.ts);
// a block with a colour that doesn't exist either renders as the wrong thing or
// throws inside its own renderer, and the surface it throws on is a projector in
// front of a class. Since nothing downstream will catch a bad enum, it has to be
// caught here, before the block can reach the document at all.
//
// A suggestion that fails is dropped and counted, not repaired. Guessing what a
// model meant is how a mangled table gets waved through; the teacher is better
// served by "two suggestions were malformed" and four good ones.
//
// The transport is a raw `fetch` rather than `supabase.functions.invoke` because
// the function streams: the reasoning arrives while the model works, and invoke
// buffers the whole body before handing it over. The distrust is unchanged — only
// the pipe is.

import { z } from "zod";

import type { LessonBlock } from "@/lib/lessons";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Shared optional trimmings. */
const label = z.string().optional();
const note = z.string().optional();

// One schema per block type the function is allowed to propose. These mirror
// @/lib/lessons exactly — when a block shape changes there, it changes here.
const textBlock = z.object({
  type: z.literal("text"),
  label,
  body: z.string().min(1),
  note,
});

const listBlock = z.object({
  type: z.literal("list"),
  label,
  // Required, with no default. A list block missing this renders nothing.
  style: z.enum(["numbered", "bullet", "checklist"]),
  items: z.array(z.string()).min(1),
  note,
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  icon: z.string().optional(),
  // NOT the title block's colours. Same field name, disjoint values — the trap
  // docs/lesson-json.md opens with.
  color: z
    .enum(["blue_bg", "green_bg", "yellow_bg", "gray_bg", "red_bg"])
    .optional(),
  title: z.string().min(1),
  body: z.string().min(1),
});

const dialogBlock = z.object({
  type: z.literal("dialog"),
  label,
  note,
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
});

const tableBlock = z.object({
  type: z.literal("table"),
  label,
  note,
  // Column-major. A row-major answer parses as columns with the wrong titles,
  // which is why `rows` being an array of strings is checked rather than assumed.
  columns: z
    .array(z.object({ title: z.string(), rows: z.array(z.string()) }))
    .min(1),
});

/** The four exercise kinds, for a homework copy. `id` is optional here and
 *  minted on insert: a stable id matters (it keys the answer and the mark), and
 *  the editor already has the one thing that can guarantee uniqueness within a
 *  document — itself. `answer` is a 0-based index into `options`. */
const finishSentenceBlock = z.object({
  type: z.literal("finish-sentence"),
  id: z.string().optional(),
  label,
  // The gap is written `___`; a prompt without one has nothing to fill in.
  sentence: z.string().includes("___"),
  options: z.array(z.string()).min(2),
  answer: z.number().int().nonnegative(),
  note,
});

const chooseDescriptionBlock = z.object({
  type: z.literal("choose-description"),
  id: z.string().optional(),
  label,
  text: z.string().min(1),
  font: z.enum(["sans", "mono"]).optional(),
  options: z.array(z.string()).min(2),
  answer: z.number().int().nonnegative(),
  note,
});

const findMistakeBlock = z.object({
  type: z.literal("find-mistake"),
  id: z.string().optional(),
  label,
  sentence: z.string().min(1),
  // An index into the sentence split on whitespace, not into an options array.
  answer: z.number().int().nonnegative(),
  note,
});

const longAnswerBlock = z.object({
  type: z.literal("long-answer"),
  id: z.string().optional(),
  label,
  question: z.string().min(1),
  hint: z.string().optional(),
  note,
});

/** What may be proposed, by what is being edited. A homework is exercises and a
 *  presentation is content — offering either set to the other kind produces
 *  blocks its editor has no palette for. */
const BLOCKS_BY_KIND = {
  lesson: z.discriminatedUnion("type", [
    textBlock,
    listBlock,
    calloutBlock,
    dialogBlock,
    tableBlock,
  ]),
  material: z.discriminatedUnion("type", [
    textBlock,
    listBlock,
    calloutBlock,
    dialogBlock,
    tableBlock,
  ]),
  homework: z.discriminatedUnion("type", [
    finishSentenceBlock,
    chooseDescriptionBlock,
    findMistakeBlock,
    longAnswerBlock,
  ]),
} as const;

/** Which of a group's three documents is being added to. */
export type SuggestKind = keyof typeof BLOCKS_BY_KIND;

/**
 * How many blocks one suggestion may carry.
 *
 * Higher for homework because a set of exercises is a set: "one of each kind,
 * plus another find-the-mistake" is five, and a teacher who asks for that should
 * get it rather than watch the whole answer be dropped for being one over.
 */
const MAX_BLOCKS: Record<SuggestKind, number> = {
  lesson: 6,
  material: 6,
  homework: 8,
};

/**
 * The suggestion around its blocks.
 *
 * Blocks are `unknown` here and checked one at a time below. Validating the
 * whole thing in one pass meant a single bad block — an exercise the model
 * forgot the answer on — threw away the four good ones beside it and the
 * teacher got nothing.
 */
const envelope = z.object({
  afterSlideId: z.string().min(1),
  stage: z.string().min(1),
  rationale: z.string().default(""),
  blocks: z.array(z.unknown()).min(1),
});

/** One proposed slide, ready to preview and insert. */
export type ContextSuggestion = {
  afterSlideId: string;
  stage: string;
  rationale: string;
  blocks: LessonBlock[];
};

export type SuggestionResult = {
  suggestions: ContextSuggestion[];
  /** What the agent said in words, if it said anything. Since the tool stopped
   *  being forced this is where a refusal, a question, or a note about what it
   *  would need arrives — the things an empty list used to stand in for. */
  answer: string;
  /** How many the model returned that didn't survive validation. Shown rather
   *  than swallowed: a run where half were dropped is worth knowing about. */
  discarded: number;
  /** One line per dropped suggestion, naming it and saying what was wrong with
   *  it. "Malformed" on its own sends the teacher to ask again and get the same
   *  answer; "too many blocks" tells them to ask for fewer, and tells whoever
   *  maintains this which rule the model keeps tripping over. */
  problems: string[];
};

/** One earlier turn of this conversation, as the model should read it back. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type SuggestOptions = {
  /** What the teacher typed this turn. What is permanently true of the class
   *  belongs in the class context, which the function already reads. */
  teacherPrompt?: string;
  /** The exchanges before this one, oldest first. The function caches everything
   *  up to the last of them, so carrying the conversation costs less per turn
   *  than starting fresh would. */
  history?: ChatMessage[];
  /** Called with each chunk of the model's reasoning as it arrives. */
  onThinking?: (delta: string) => void;
  /** Aborts the request, which also stops the model call server-side. */
  signal?: AbortSignal;
};

/**
 * Asks the edge function for slides to add to this group's copy of a document.
 *
 * The function does the reading — the class's context, every student's notes,
 * unit reports and handed-in homework, and what has already been added for this
 * class in earlier lessons — because that material has no business being
 * assembled in a browser. What goes over the wire from here is which group, which
 * lesson, whatever the teacher typed, and the conversation so far.
 */
export async function suggestAdvancedContext(
  kind: SuggestKind,
  groupId: string,
  /** The lesson id for a presentation or a material; the homework's slug for a
   *  homework. */
  documentId: string,
  options: SuggestOptions = {},
): Promise<SuggestionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You're signed out. Sign in and try again.");

  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/functions/v1/suggest-advanced-context`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind,
        groupId,
        documentId,
        // The old name for `documentId`, still sent so a browser running new
        // code against a not-yet-redeployed function keeps working for the kind
        // that function knows about.
        lessonId: documentId,
        teacherPrompt: options.teacherPrompt,
        history: options.history,
      }),
      signal: options.signal,
    },
  );

  // A failure before the stream opens is still a JSON body with a status — the
  // function only switches to `text/event-stream` once it has everything it needs.
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `The request failed (${response.status}).`);
  }

  // A 200 that isn't a stream means the deployed function predates streaming.
  // Worth naming precisely: parsing it as SSE finds no frames, runs the body out,
  // and reports "the connection closed" — which sends you looking at the network
  // instead of at the deploy.
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      suggestions?: unknown[];
    } | null;

    if (body?.error) throw new Error(body.error);
    if (Array.isArray(body?.suggestions)) {
      throw new Error(
        "The deployed suggest-advanced-context function is an older version that doesn't stream. Run: supabase functions deploy suggest-advanced-context",
      );
    }
    throw new Error(
      `The function answered with ${contentType || "no content type"} instead of a stream.`,
    );
  }

  const { suggestions, answer } = await readSuggestions(
    response.body,
    options.onThinking,
  );
  return { ...validate(kind, suggestions), answer };
}

/**
 * Reads the SSE body, feeding reasoning out as it arrives and returning the
 * suggestions when they land.
 *
 * Only the reasoning streams. The tool's input arrives as partial-JSON deltas
 * that can't be parsed incrementally without guessing where an object ends, so
 * the suggestions come in one `result` event at the end — which is fine, because
 * what the teacher is waiting to watch is the thinking.
 */
async function readSuggestions(
  body: ReadableStream<Uint8Array>,
  onThinking?: (delta: string) => void,
): Promise<{ suggestions: unknown[]; answer: string }> {
  // Decoded by hand rather than through `TextDecoderStream`: a UTF-8 character can
  // straddle two chunks, and `{ stream: true }` is what holds the halves together
  // — which matters here because the reasoning is full of em dashes and accented
  // student names.
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let suggestions: unknown[] | null = null;
  let answer: string | null = null;
  let failure: string | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. Anything after the last one is a
    // partial frame — leave it in the buffer for the next chunk.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let event = "message";
      const dataLines: string[] = [];

      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;

      let data: unknown;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }

      if (event === "thinking") {
        const delta = (data as { delta?: unknown }).delta;
        if (typeof delta === "string") onThinking?.(delta);
      } else if (event === "result") {
        const list = toList((data as { suggestions?: unknown }).suggestions);
        // The function now refuses a malformed tool input before it ever gets
        // here, but this half needs no deploy and is the half that decides what
        // the teacher sees — so it draws the same distinction independently.
        if (list === null) {
          failure =
            "The suggestions came back in a shape this couldn't read, so they were dropped. Ask again — this is a fault on our side, not a verdict on the class.";
        } else {
          suggestions = list;
        }
      } else if (event === "answer") {
        const text = (data as { answer?: unknown }).answer;
        if (typeof text === "string") answer = text;
      } else if (event === "error") {
        const message = (data as { error?: unknown }).error;
        failure = typeof message === "string" ? message : "The model call failed.";
      }
    }
  }

  if (failure) throw new Error(failure);
  if (!suggestions && answer === null) {
    // The stream ended without any of the three — a dropped connection, or the
    // function dying mid-flight. Saying so is better than showing an empty list,
    // which reads as "the model had nothing to suggest".
    throw new Error("The connection closed before the suggestions arrived.");
  }
  // An answer with no tool call is a complete turn: it declined, or asked
  // something back.
  return { suggestions: suggestions ?? [], answer: answer ?? "" };
}

/**
 * The suggestions as a list, however they arrived — or `null` when they arrived
 * in a shape no list can be got out of.
 *
 * A tool call is supposed to hand back an array. It does not always: the model
 * sometimes fills an array-typed parameter with a JSON *string* of that array,
 * and the whole answer — anchors, blocks, answer keys, all of it valid — was
 * landing as "nothing to suggest" because it wasn't literally an Array.
 *
 * `null` rather than `[]` for the unreadable cases, because those two are
 * different facts and the drawer says different things about them: an empty
 * list is a considered "nothing to add here", and it tells the teacher to go
 * and write more class context. A parse failure is our bug, and telling them to
 * fix their data for it sends them somewhere there is nothing to fix.
 *
 * Parsed here as well as in the function, deliberately. This half needs no
 * deploy, and it is the half that decides what the teacher sees.
 */
function toList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The suggestions half only — the words the agent said arrive on their own
 *  event, and are joined back on by the caller. */
function validate(
  kind: SuggestKind,
  raw: unknown[],
): Omit<SuggestionResult, "answer"> {
  const blockSchema = BLOCKS_BY_KIND[kind];
  const suggestions: ContextSuggestion[] = [];
  const problems: string[] = [];
  let discarded = 0;

  for (const item of raw) {
    const shell = envelope.safeParse(item);
    if (!shell.success) {
      discarded += 1;
      problems.push(describe(item, shell.error));
      continue;
    }

    const name = `“${shell.data.stage}”`;
    const blocks: LessonBlock[] = [];
    const rejected: string[] = [];

    for (const [index, block] of shell.data.blocks.entries()) {
      const parsed = blockSchema.safeParse(block);
      if (parsed.success) {
        blocks.push(parsed.data as LessonBlock);
      } else {
        rejected.push(`block ${index + 1} (${blockType(block)}) — ${first(parsed.error)}`);
      }
    }

    if (blocks.length === 0) {
      discarded += 1;
      problems.push(`${name}: ${rejected[0] ?? "no usable blocks"}`);
      continue;
    }

    // Over the ceiling, trim rather than refuse: the extra blocks are the
    // model's enthusiasm, not a defect, and losing four good exercises to keep
    // a limit is the wrong trade in both directions.
    const kept = blocks.slice(0, MAX_BLOCKS[kind]);
    if (blocks.length > kept.length) {
      problems.push(
        `${name}: kept the first ${kept.length} of ${blocks.length} blocks.`,
      );
    }
    if (rejected.length > 0) {
      problems.push(`${name}: ${rejected.join("; ")}`);
    }

    suggestions.push({
      afterSlideId: shell.data.afterSlideId,
      stage: shell.data.stage,
      rationale: shell.data.rationale,
      blocks: kept,
    });
  }

  return { suggestions, discarded, problems };
}

/** The `type` a rejected block claimed, for naming it in the report. */
function blockType(block: unknown): string {
  return typeof block === "object" && block !== null && "type" in block
    ? String((block as { type: unknown }).type)
    : "no type";
}

/** The first issue only — a block that fails its type check fails every other
 *  member of the union too, and the list of near-misses is noise. */
function first(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "rejected";
  const where = issue.path.join(".");
  return `${where ? `${where}: ` : ""}${issue.message.toLowerCase()}`;
}

/** A suggestion dropped before its blocks were even reached — no anchor, no
 *  stage, nothing to put anywhere. */
function describe(item: unknown, error: z.ZodError): string {
  const name =
    typeof item === "object" && item !== null && "stage" in item &&
    typeof (item as { stage?: unknown }).stage === "string" &&
    (item as { stage: string }).stage !== ""
      ? `“${(item as { stage: string }).stage}”`
      : "one suggestion";

  return `${name}: ${first(error)}`;
}
