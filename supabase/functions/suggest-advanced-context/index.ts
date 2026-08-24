// Asks Claude what this particular class needs on top of a shared lesson, and
// streams the reasoning back while it works.
//
// Here rather than in the browser for the usual reason plus one more: the
// ANTHROPIC_API_KEY has nowhere safe to live in a Vite SPA, and the input to the
// question — every student's notes, their test scores, the answers they wrote by
// hand, the teacher's own remarks about them — is exactly the material that should
// be assembled server-side and never handed to the client to assemble for itself.
//
// The output is whole SLIDES, not blocks dropped into existing ones. A block
// wedged into a slide built for something else reads as an interruption; a slide
// of its own gets a name and a place in the running order, which is what the
// teacher actually wanted.
//
// `propose_slides` is a forced tool call, so the model fills a schema instead of
// writing JSON inside a code fence for us to scrape. That still isn't trust: the
// client re-validates every suggestion against a zod schema before it can be
// inserted (see src/features/studio/data/suggest-context.ts). `parseLesson` checks
// nothing, and a block with a colour that doesn't exist throws at render time — on
// a projector, in front of the class.
//
// PROMPT LAYOUT — the system array is ordered most-stable-first, because prompt
// caching matches on the cumulative prefix and each breakpoint caches everything
// up to it:
//
//   1. STATIC_RULES   cached   identical for every call this deployment ever makes
//   2. bookOverview   cached   identical until the curriculum changes
//   3. classDossier   cached   identical until something about THIS class changes
//   4. lessonNote     uncached changes per lesson, and is a couple of lines
//
// The fourth and last breakpoint goes on the conversation instead — the message
// just before the teacher's new question — so the lesson and every earlier turn
// are read from cache rather than re-sent. That is what makes a conversation get
// CHEAPER per turn rather than steadily more expensive: the only thing paying
// full price on turn four is the sentence the teacher just typed.
//
// Nothing after that breakpoint is cached, deliberately: `cache_control` on
// content that changes every call buys no hit and costs a write.
//
// Secrets: ANTHROPIC_API_KEY. Everything else is injected by the platform.
//
// Deploy: supabase functions deploy suggest-advanced-context

import Anthropic from "npm:@anthropic-ai/sdk@0.65.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, HttpError, json, requireStaff } from "../_shared/admin.ts";
import { ALEX_CANON, BOOK_ONE_GRAMMAR, CANON_PROVIDED } from "./canon.ts";

const MODEL = "claude-sonnet-5";

/** How many of a class's earlier lessons the history looks back over. Continuity
 *  is a short-term concern — what Alex said last month is context, what he said
 *  two terms ago is a log. */
const HISTORY_LESSONS = 6;

/** How many submissions per student the digest carries, newest first. */
const HOMEWORK_PER_STUDENT = 5;

/** How much of the conversation is carried forward. Six messages is three
 *  exchanges — enough for "no, the other student" to make sense, short enough
 *  that a long session doesn't drag its whole history behind it. */
const MAX_HISTORY_MESSAGES = 6;

/** The block types a suggestion may use.
 *
 *  `image` is deliberately absent: its `path` must be a real Supabase Storage
 *  object from a real upload, and an invented one renders as a broken picture at
 *  best. `title` is absent too — a cover belongs to the lesson, not to one class's
 *  addition to it. The exercise blocks are homework's, and this is a presentation.
 */
const BLOCK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: ["text", "list", "callout", "dialog", "table"],
    },
    label: { type: "string", description: "Optional small heading." },
    note: { type: "string", description: "Optional quiet line beneath." },

    // text, callout
    body: {
      type: "string",
      description: "Required for `text` and `callout`. Block markdown.",
    },

    // callout
    title: { type: "string", description: "Required for `callout`." },
    icon: { type: "string", description: "Optional emoji for a `callout`." },
    color: {
      type: "string",
      enum: ["blue_bg", "green_bg", "yellow_bg", "gray_bg", "red_bg"],
      description:
        "`callout` only. These values are NOT the ones a title block takes.",
    },

    // list
    style: {
      type: "string",
      enum: ["numbered", "bullet", "checklist"],
      description: "Required for `list`. There is no default.",
    },
    items: { type: "array", items: { type: "string" } },

    // dialog
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speaker", "text"],
        properties: {
          speaker: { type: "string" },
          text: { type: "string" },
        },
      },
    },

    // table — column-major, not row-major
    columns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "rows"],
        properties: {
          title: { type: "string" },
          rows: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const TOOL = {
  name: "propose_slides",
  description:
    "Propose whole slides of advanced context for this class, each anchored after an existing slide of the lesson.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["afterSlideId", "stage", "rationale", "blocks"],
          properties: {
            afterSlideId: {
              type: "string",
              description:
                "The id of the existing slide this new slide goes after. Must be one of the slide ids given.",
            },
            stage: {
              type: "string",
              description:
                "A proper name for this slide's stage, in the house style — e.g. \"Marina's Weekend\", not \"Advanced Context\". Stage names are content, not administrative labels.",
            },
            rationale: {
              type: "string",
              description:
                "One sentence, for the teacher: why THIS class needs this. Name the student, the score, or the pattern it comes from — evidence, not a summary of the slide.",
            },
            blocks: {
              type: "array",
              maxItems: 4,
              items: BLOCK_SCHEMA,
              description: "The full content of the new slide.",
            },
          },
        },
      },
    },
  },
} as const;

// ── The system prompt ────────────────────────────────────────────────────────
// Block 1 of 4, and the one that never changes. Everything variable is kept out
// of it on purpose: a single interpolated value here would invalidate the cache
// prefix for every call in the system, not just this one.

const STATIC_RULES = `You help an English teacher adapt a shared lesson for one specific class.

You are given the class, its students, their per-unit progress reports, the homework they have handed in, everything that has already been added for this class in earlier lessons, and the lesson as it stands. You propose whole extra SLIDES — "advanced context" — each anchored after an existing slide. The teacher reviews each one and inserts the ones they want.

## What makes a good suggestion

- It comes from something concrete in the input: a student's stated interest, a low test score, a mistake they actually made in a homework, a pattern across their reports. Say which, in the rationale.
- The concrete fact has to be IN THE SLIDE, not only in the rationale. A dialogue that mentions Marina's climbing is personalization; a generic dialogue with a rationale saying "Marina likes climbing" is not.
- It ADDS. The base lesson is not yours to rewrite, and the teacher cannot remove it. Extra examples, a harder variant, vocabulary this class keeps missing, a dialogue set in their world.
- It sits after a slide where it belongs, by that slide's id.
- The stage name is content, not a label: "Marina's Weekend", "Two Ways to Say No", "Diego's Trail Run" — never "Advanced Context", "Extra Practice", or "Personalized Slide".
- It is in English, at the level the lesson is pitched at.
- Do not repeat something already on the lesson's slides, and do not repeat something already in this class's advanced-context history.

Fewer, sharper suggestions beat more. If the input does not support a suggestion, propose nothing rather than inventing a reason.

## The conversation

This is a conversation with the teacher, and the turns above are yours and theirs. Read them: a follow-up like "not that one, do Diego instead" or "shorter" refers to what you just proposed. Do not repeat a slide you have already proposed in this conversation unless you are asked to revise it — and when you revise, say what changed in the rationale. If the teacher's message says which suggestions they inserted, take that as the strongest available signal about what this teacher wants.

## Personalization

- A student's PERSONAL interest comes from their own context line. Use it in a slide aimed at that student, and name them.
- A SHARED interest comes from the class's context. Use it when the slide is for the whole room.
- Never attribute one student's interest to another, and never invent an interest that is not written down.

## Alex

${ALEX_CANON}

Before proposing a dialog with Alex, check the class's advanced-context history. If Alex has already engaged with this student's interest in an earlier lesson, either build on it explicitly (a callback the class will recognise) or deliberately take a different angle — never repeat the same joke or scenario as if it were new.

## Block rules — these matter, because nothing validates them at render time

- \`list\` MUST have \`style\`: "numbered", "bullet" or "checklist". There is no default.
- \`callout\` colours are blue_bg / green_bg / yellow_bg / gray_bg / red_bg, and nothing else.
- \`table\` is column-major: \`columns: [{ title, rows: [...] }]\`, one entry per COLUMN.
- \`text\` and \`callout\` need \`body\`; \`callout\` also needs \`title\`.
- Body text is block markdown: paragraphs, line breaks, headings and lists survive as typed.`;

// ── Summaries ────────────────────────────────────────────────────────────────

type Block = {
  type?: string;
  advancedContext?: true;
  [k: string]: unknown;
};

type Slide = {
  id?: string;
  stage?: string;
  goal?: string;
  advancedContext?: true;
  blocks?: Block[];
};

/** The readable text of a block, whatever kind it is. */
function blockText(block: Block): string {
  if (typeof block.body === "string") return block.body;
  if (typeof block.title === "string") return block.title;
  if (Array.isArray(block.items)) return block.items.join("; ");
  if (Array.isArray(block.lines)) {
    return (block.lines as { speaker?: string; text?: string }[])
      .map((line) => `${line.speaker ?? ""}: ${line.text ?? ""}`)
      .join(" / ");
  }
  return "";
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/** One line per block of the lesson being worked on — enough for the model to
 *  know what is already there without shipping every word of it. */
function summariseBlock(block: Block): string {
  const mark = block.advancedContext ? " [already advanced context]" : "";
  const snippet = clip(blockText(block), 140);
  return `    - ${block.type}${mark}${snippet ? `: ${snippet}` : ""}`;
}

/** PostgREST returns an embedded to-one either as an object or as a one-element
 *  array, depending on how it resolves the relationship. */
function one<T>(embedded: unknown): T | undefined {
  return (Array.isArray(embedded) ? embedded[0] : embedded) as T | undefined;
}

// ── The class dossier ────────────────────────────────────────────────────────
// Block 3 of 4. Everything that is true of this class and false of the next one,
// gathered into one cached block because it all changes on the same cadence —
// when a homework is marked, a report is written, or a suggestion is approved.
//
// The spec this was built from put only the advanced-context history here and left
// the students in the user message. That was written before homework joined the
// inputs. Students, reports and homework change no more often than the history
// does, and none of them changes per lesson — leaving them in the user message
// would pay full price for all of it on every call, which is precisely the case
// this feature exists to make cheap (a teacher generating for three lessons of the
// same class in one sitting).

type Student = {
  id: string;
  full_name: string | null;
  notes: string | null;
};

/**
 * What has already been added for this class, in earlier lessons.
 *
 * This is what makes continuity possible — Alex picking up a thread from three
 * weeks ago — and what stops the same joke landing in four lessons running.
 *
 * Only advanced context goes in. The lessons' own content is already covered by
 * the book overview, and repeating it here would double the cost of the one block
 * that grows with the length of the course. For the same reason the window is the
 * last few lessons rather than everything: continuity is short-term, and a log
 * that grows per class per term eventually costs more than it teaches.
 */
async function buildGroupHistory(
  service: SupabaseClient,
  groupId: string,
  currentLessonId: string,
): Promise<string> {
  const { data, error } = await service
    .from("group_lessons")
    .select("lesson_id, document, position")
    .eq("group_id", groupId)
    .neq("lesson_id", currentLessonId);

  if (error) throw new HttpError(500, error.message);

  type Entry = { lessonId: string; position: number; lines: string[] };
  const entries: Entry[] = [];

  for (const row of (data ?? []) as {
    lesson_id: string;
    document: { slides?: Slide[] } | null;
    position: number | null;
  }[]) {
    const lines: string[] = [];

    for (const slide of row.document?.slides ?? []) {
      if (slide.advancedContext) {
        // A whole slide the class was given: name it, and say what is on it.
        const kinds = (slide.blocks ?? [])
          .map((block) => block.type)
          .filter(Boolean)
          .join(", ");
        const gist = clip(
          (slide.blocks ?? []).map(blockText).filter(Boolean).join(" — "),
          80,
        );
        lines.push(
          `slide "${slide.stage || slide.id || "untitled"}"${
            kinds ? ` (${kinds})` : ""
          }${gist ? `: ${gist}` : ""}`,
        );
        continue;
      }

      // A block added to a base slide — the shape the older suggestions produced.
      for (const block of slide.blocks ?? []) {
        if (block.advancedContext !== true) continue;
        const gist = clip(blockText(block), 80);
        lines.push(`${block.type}${gist ? `: ${gist}` : ""}`);
      }
    }

    if (lines.length > 0) {
      entries.push({
        lessonId: row.lesson_id,
        position: row.position ?? 0,
        lines,
      });
    }
  }

  if (entries.length === 0) {
    // Deliberately a sentence rather than an empty string. Dropping the block
    // would shift every breakpoint after it and invalidate cache that would
    // otherwise have been there — and "nothing yet" is itself worth telling the
    // model, which should then know not to reach for a callback.
    return `# What this class has already been given

(no advanced context has been added to this class yet — this may be its first personalized lesson)`;
  }

  // Oldest first, so the most recent thing Alex did is the last thing read —
  // the same recency ordering the unit reports use.
  entries.sort((a, b) => a.position - b.position);

  const recent = entries.slice(-HISTORY_LESSONS);

  return `# What this class has already been given

${recent
  .map((entry) =>
    entry.lines.map((line) => `${entry.lessonId} — ${line}`).join("\n"),
  )
  .join("\n")}`;
}

/**
 * The homework these students have handed in — the only place in the dossier
 * where the evidence is the student's own work rather than someone's opinion of
 * it.
 *
 * Three things are pulled out, in descending order of how much they teach:
 * what they wrote in their own words, which questions they got wrong (with the
 * answer they chose), and the score with the teacher's feedback. The questions
 * they got RIGHT are left out — they say nothing about what is still missing, and
 * they would double the size of the block.
 */
async function buildHomeworkDigest(
  service: SupabaseClient,
  students: Student[],
): Promise<string> {
  if (students.length === 0) return "";

  const { data, error } = await service
    .from("homework_submissions")
    .select(
      "student_id, status, score, feedback, answers, marks, answer_key, submitted_at, homework:homework (title, document)",
    )
    .in(
      "student_id",
      students.map((student) => student.id),
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error) throw new HttpError(500, error.message);

  const byStudent = new Map<string, string[]>();

  for (const row of (data ?? []) as {
    student_id: string;
    status: string | null;
    score: number | string | null;
    feedback: string | null;
    answers: Record<string, unknown> | null;
    marks: Record<string, unknown> | null;
    answer_key: Record<string, unknown> | null;
    homework: unknown;
  }[]) {
    const already = byStudent.get(row.student_id) ?? [];
    if (already.length >= HOMEWORK_PER_STUDENT) continue;

    const homework = one<{
      title?: string | null;
      document?: { slides?: Slide[] } | null;
    }>(row.homework);

    // `answers`, `marks` and `answer_key` are all maps keyed by block id
    // (migration 0005), so the homework's own document is what turns an id back
    // into the question it was.
    const questions = new Map<string, Block>();
    for (const slide of homework?.document?.slides ?? []) {
      for (const block of slide.blocks ?? []) {
        const id = block.id;
        if (typeof id === "string") questions.set(id, block);
      }
    }

    const head = [
      `- "${homework?.title ?? "untitled homework"}"`,
      row.status ?? "",
      row.score === null || row.score === undefined
        ? ""
        : `${row.score}/10`,
    ]
      .filter(Boolean)
      .join(" · ");

    const lines = [head];
    if (row.feedback) lines.push(`  teacher: ${clip(row.feedback, 160)}`);

    for (const [id, block] of questions) {
      const written = row.answers?.[id];

      if (block.type === "long-answer") {
        // Marked by hand, so there is no `marks` entry — what matters is the
        // sentence they built, which is the closest thing to hearing them speak.
        if (typeof written === "string" && written.trim() !== "") {
          lines.push(
            `  wrote: "${clip(written, 200)}" — ${clip(String(block.question ?? ""), 80)}`,
          );
        }
        continue;
      }

      // Objective blocks: only the ones they got wrong. `marks` is empty until
      // the submission is graded, so an in-progress one contributes its header
      // and nothing else — which is honest, not a gap.
      if (row.marks?.[id] !== false) continue;

      const options = Array.isArray(block.options)
        ? (block.options as string[])
        : [];
      const chose =
        typeof written === "number" ? (options[written] ?? "?") : "nothing";
      const keyIndex = row.answer_key?.[id];
      const correct =
        typeof keyIndex === "number" ? (options[keyIndex] ?? "?") : "?";
      const prompt = clip(
        String(block.sentence ?? block.text ?? block.question ?? ""),
        80,
      );

      lines.push(`  missed: "${prompt}" → chose "${chose}" (answer: "${correct}")`);
    }

    already.push(lines.join("\n"));
    byStudent.set(row.student_id, already);
  }

  if (byStudent.size === 0) return "";

  return `# Homework handed in

${students
  .filter((student) => byStudent.has(student.id))
  .map(
    (student) =>
      `## ${student.full_name || "unnamed student"}\n${byStudent
        .get(student.id)!
        .join("\n")}`,
  )
  .join("\n\n")}`;
}

// ── Streaming ────────────────────────────────────────────────────────────────

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Handler ──────────────────────────────────────────────────────────────────
// Not wrapped in `handle()` like the other functions: that helper turns the
// return value into a JSON body, and this one answers with a stream. The CORS and
// method handling it does are repeated here instead, and `HttpError` is caught the
// same way — but only for failures that happen BEFORE the stream opens. Once the
// response headers are out, a failure can only be an `error` event; there is no
// status code left to change.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const caller = await requireStaff(req);

    const { groupId, lessonId, teacherPrompt, history } = (await req
      .json()
      .catch(() => ({}))) as {
      groupId?: string;
      lessonId?: string;
      teacherPrompt?: string;
      history?: { role?: string; content?: string }[];
    };
    if (!groupId || !lessonId) {
      throw new HttpError(400, "groupId and lessonId are required.");
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new HttpError(
        500,
        "This function has no ANTHROPIC_API_KEY. Set it in the project's Edge Function secrets.",
      );
    }

    const { service } = caller;

    // The service client bypasses RLS, so ownership is re-checked here rather than
    // assumed from the fact that the caller got this far. This mirrors
    // `owns_group()` from migration 0007.
    const { data: group, error: groupError } = await service
      .from("groups")
      .select("id, name, context, teacher_id")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) throw new HttpError(500, groupError.message);
    if (!group) throw new HttpError(404, "No such group.");
    if (!caller.isAdmin && group.teacher_id !== caller.callerId) {
      throw new HttpError(403, "That group isn't yours.");
    }

    const { data: copy, error: copyError } = await service
      .from("group_lessons")
      .select("document")
      .eq("group_id", groupId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (copyError) throw new HttpError(500, copyError.message);
    if (!copy?.document) {
      throw new HttpError(404, "This group has no copy of that lesson.");
    }

    const { data: members, error: membersError } = await service
      .from("group_students")
      .select("student_id, student:students (id, full_name, notes)")
      .eq("group_id", groupId);

    if (membersError) throw new HttpError(500, membersError.message);

    const students = (members ?? [])
      .map((row: Record<string, unknown>) => one<Student>(row.student))
      .filter((student): student is Student => Boolean(student));

    const studentIds = students.map((student) => student.id);

    const { data: reports, error: reportsError } = studentIds.length
      ? await service
          .from("student_unit_reports")
          .select(
            "student_id, unit, observations, test_score, teacher_notes, module:modules (name)",
          )
          .in("student_id", studentIds)
          .order("unit", { ascending: true })
      : { data: [], error: null };

    if (reportsError) throw new HttpError(500, reportsError.message);

    const reportsByStudent = new Map<string, string[]>();
    for (const row of (reports ?? []) as Record<string, unknown>[]) {
      const moduleName = one<{ name?: string | null }>(row.module)?.name ?? "";
      const line = [
        `unit ${row.unit}${moduleName ? ` of ${moduleName}` : ""}`,
        row.test_score === null ? "no test score" : `test ${row.test_score}/10`,
        row.observations ? `observations: ${row.observations}` : "",
        row.teacher_notes ? `on the test: ${row.teacher_notes}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const id = row.student_id as string;
      reportsByStudent.set(id, [...(reportsByStudent.get(id) ?? []), line]);
    }

    const doc = copy.document as {
      title?: string;
      unit?: string;
      context?: string;
      minorCanDo?: string;
      grammarFocus?: string[];
      slides?: Slide[];
    };

    const slides = (doc.slides ?? [])
      .filter((slide) => (slide.id ?? "") !== "")
      .map((slide) => {
        const blocks = (slide.blocks ?? []).map(summariseBlock).join("\n");
        return [
          `  slide id: ${slide.id}`,
          `  stage: ${slide.stage ?? ""}`,
          slide.goal ? `  goal: ${slide.goal}` : "",
          blocks ? `  blocks:\n${blocks}` : "  blocks: (none)",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    if (!slides) {
      throw new HttpError(
        422,
        "None of this lesson's slides have an id, so there is nothing to anchor a suggestion to.",
      );
    }

    // ── The four system blocks ───────────────────────────────────────────────

    const bookOverview = `# The course

${BOOK_ONE_GRAMMAR}`;

    const [history, homework] = await Promise.all([
      buildGroupHistory(service, groupId, lessonId),
      buildHomeworkDigest(service, students),
    ]);

    const studentBlock =
      students.length === 0
        ? "(nobody on the register yet)"
        : students
            .map((student) => {
              const lines = reportsByStudent.get(student.id) ?? [];
              return [
                `- ${student.full_name || "unnamed student"}`,
                student.notes ? `  context: ${student.notes}` : "",
                lines.length
                  ? `  reports:\n${lines.map((line) => `    - ${line}`).join("\n")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n");

    const classDossier = [
      `# The class

name: ${group.name ?? ""}
context: ${group.context || "(none written yet)"}`,
      `# The students

${studentBlock}`,
      homework,
      history,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Uncached, and empty until the progression in canon.ts is real — a note built
    // from a placeholder reads to the model as a constraint that happens to say
    // nothing, which is worse than saying nothing at all.
    const lessonNote = CANON_PROVIDED
      ? `# This lesson

"${doc.title ?? lessonId}" (${lessonId}), unit ${doc.unit ?? "?"}. Use only structure unlocked at or before this lesson in the progression above.`
      : "";

    // The lesson opens the conversation and never changes within it, so it sits
    // in the first user message where the cache breakpoint below can cover it —
    // rather than being restated in every turn's prompt.
    const lessonMessage = `# The lesson you are adding to

title: ${doc.title ?? ""}
unit: ${doc.unit ?? ""}
context: ${doc.context ?? ""}
can-do: ${doc.minorCanDo ?? ""}
grammar focus: ${(doc.grammarFocus ?? []).join(", ")}

## Slides

${slides}`;

    const prompt =
      teacherPrompt?.trim() ||
      "Suggest advanced context for this lesson. Use your judgement about what this class needs most.";

    // Earlier turns of this conversation, so a follow-up can say "not that one,
    // the other student" and be understood. Sanitised rather than trusted: this
    // arrives from the browser, and a malformed entry would fail the whole call
    // with an error about a message shape the teacher can do nothing about.
    const priorTurns = (Array.isArray(history) ? history : [])
      .filter(
        (entry): entry is { role: "user" | "assistant"; content: string } =>
          (entry?.role === "user" || entry?.role === "assistant") &&
          typeof entry.content === "string" &&
          entry.content.trim() !== "",
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map((entry) => ({
        role: entry.role,
        content: entry.content.slice(0, 4000),
      }));

    const messages = [
      { role: "user" as const, content: lessonMessage },
      ...priorTurns,
      { role: "user" as const, content: prompt },
    ];

    // The fourth and last breakpoint, on the final message of the conversation
    // BEFORE this turn's question. Everything up to it — the three system blocks,
    // the lesson, and every earlier turn — is then a cache read rather than a
    // re-send, which is what makes a long conversation cheaper per turn instead
    // of steadily more expensive.
    const cacheAt = messages.length - 2;
    const cachedMessages = messages.map((message, i) =>
      i === cacheAt
        ? {
            role: message.role,
            content: [
              {
                type: "text" as const,
                text: message.content,
                cache_control: { type: "ephemeral" as const },
              },
            ],
          }
        : message,
    );

    const system = [
      { type: "text" as const, text: STATIC_RULES, cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: bookOverview, cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: classDossier, cache_control: { type: "ephemeral" as const } },
      ...(lessonNote ? [{ type: "text" as const, text: lessonNote }] : []),
    ];

    const anthropic = new Anthropic({ apiKey });

    const stream = anthropic.messages.stream({
      model: MODEL,
      // Roomy on purpose: adaptive thinking draws from the same budget as the
      // answer, and a run that spends it all reasoning returns no tool call at
      // all — which reads downstream as "the model had nothing to suggest".
      max_tokens: 16000,
      // `display: "summarized"` is load-bearing: the default on Sonnet 5 is
      // "omitted", which streams thinking blocks with empty text. Without this the
      // drawer would show an empty panel and look broken.
      thinking: { type: "adaptive", display: "summarized" },
      system,
      // Forced: the answer we want is a filled schema, and leaving the choice open
      // is how you end up parsing JSON out of a paragraph of preamble. (Forced
      // tool choice alongside thinking is fine on the Claude API; only Bedrock
      // requires thinking to be off.)
      tool_choice: { type: "tool", name: TOOL.name },
      tools: [TOOL],
      messages: cachedMessages,
    });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(sse(event, data)));

        try {
          // Iterating the raw events rather than a convenience listener: the
          // documented shape for reasoning is `content_block_delta` carrying a
          // `thinking_delta`, and it is the one guaranteed not to move.
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "thinking_delta"
            ) {
              send("thinking", { delta: event.delta.thinking });
            }
          }

          const message = await stream.finalMessage();

          // The only way to know the cache is actually being hit rather than just
          // configured. On a first call for a class expect cacheWrite > 0 and
          // cacheRead === 0; on the second, the reverse.
          console.log("[suggest] usage", {
            input: message.usage.input_tokens,
            cacheWrite: message.usage.cache_creation_input_tokens,
            cacheRead: message.usage.cache_read_input_tokens,
            output: message.usage.output_tokens,
          });

          const use = message.content.find((part) => part.type === "tool_use");
          if (!use || use.type !== "tool_use") {
            send("error", { error: "The model didn't return any suggestions." });
          } else {
            const input = use.input as { suggestions?: unknown[] };
            send("result", { suggestions: input.suggestions ?? [] });
          }
        } catch (err) {
          console.error(err);
          send("error", {
            error: (err as Error).message ?? "The model call failed.",
          });
        } finally {
          controller.close();
        }
      },
      cancel() {
        // The teacher closed the drawer or pressed cancel — stop paying for
        // tokens nobody is going to read.
        stream.abort();
      },
    });

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status);
    }
    console.error(err);
    return json({ error: (err as Error).message ?? "Unexpected error." }, 500);
  }
});
