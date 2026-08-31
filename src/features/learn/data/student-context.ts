// The student's own context, read from their side.
//
// `students.notes` is one free-text field holding two different things: what
// staff keep on a student (see student-notes-card) and the blocks the
// onboarding form appends (0012). RLS lets a student read their own row, so the
// filtering has to happen here — a student's page shows the answers they gave,
// never the teacher's working notes about them.

import { supabase } from "@/lib/supabase";

/** One answered block of the student's context. */
export type ContextBlock = {
  /** The heading the block was written under, e.g. "Onboarding (2026-08-30)". */
  title: string;
  /** Question/answer pairs, in the order they were asked. */
  answers: { question: string; answer: string }[];
};

/** The marker `buildOnboardingSummary` writes above each block it appends. */
const HEADING = /^---\s*(.+?)\s*---$/;

/**
 * The blocks of the student's context that the student themselves wrote.
 *
 * Anything outside a `--- ... ---` heading is staff-written prose and is
 * dropped, as is any block that isn't a run of Q:/A: lines.
 */
export function parseOwnContext(notes: string): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  let current: ContextBlock | null = null;
  let question: string | null = null;

  for (const raw of notes.split("\n")) {
    const line = raw.trim();
    const heading = HEADING.exec(line);

    if (heading) {
      current = { title: heading[1], answers: [] };
      blocks.push(current);
      question = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("Q:")) {
      question = line.slice(2).trim();
    } else if (line.startsWith("A:") && question) {
      current.answers.push({ question, answer: line.slice(2).trim() });
      question = null;
    } else if (line && !question && current.answers.length > 0) {
      // A wrapped answer. A student's own note can run to several paragraphs,
      // and the block format puts the whole of it after one `A:`.
      const last = current.answers[current.answers.length - 1];
      last.answer = `${last.answer}\n${line}`;
    }
  }

  return blocks.filter((block) => block.answers.length > 0);
}

/** The signed-in student's own context blocks. */
export async function fetchMyContext(): Promise<ContextBlock[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("students")
    .select("notes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseOwnContext(data?.notes ?? "");
}

/**
 * Append a note of the student's own to their context.
 *
 * Through an RPC because a student cannot write their `students` row directly —
 * see supabase/migrations/0021_student_context_notes.sql. Append-only: there is
 * no edit and no delete, for the student or for this app.
 */
export async function addContextNote(
  title: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc("add_student_context_note", {
    note_title: title,
    note_body: body,
  });
  if (error) throw new Error(error.message);
}
