import * as React from "react";
import {
  AlertTriangleIcon,
  ArrowUpIcon,
  CheckIcon,
  PlusIcon,
  SquareIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClaudeLogo } from "@/components/claude-logo";
import { cn } from "@/lib/utils";
import { AdvancedMark, BlockView } from "@/features/blocks";
import {
  suggestAdvancedContext,
  type ChatMessage,
  type ContextSuggestion,
  type SuggestKind,
} from "../data/suggest-context";
import type { EditorSlide } from "../model";

/** How many messages of the conversation travel with the next question. Matches
 *  the ceiling the function enforces; sending more would only be trimmed there. */
const HISTORY_LIMIT = 6;

/**
 * The wordmark, breathing, while the agent works.
 *
 * A spinner says "something is happening"; this says *who* is doing it, which is
 * the thing worth knowing when the wait is fifteen seconds of somebody reading
 * your class's homework. No label beside it — the reasoning streaming underneath
 * says what it is doing far better than the word "thinking" would.
 */
function Working() {
  return (
    <span className="block animate-pulse font-display text-2xl lowercase leading-none tracking-tight text-primary">
      lexicon
    </span>
  );
}

/** One exchange: what the teacher asked for, and what came back. */
type Turn = {
  id: number;
  /** Empty when they just pressed send without typing anything. */
  prompt: string;
  /** What actually went to the model as this turn's message — the prompt, plus
   *  any "I inserted these" news. Replayed verbatim as history, so the bytes the
   *  cache was keyed on are the bytes that come back. */
  sent: string;
  thinking: string;
  /** What it said in words this turn, if anything. Since the tool stopped being
   *  forced, a turn can be a sentence rather than a list. */
  answer: string;
  /** Everything this turn proposed — kept whole, so the conversation can still
   *  refer to a suggestion after it has been inserted and left the list. */
  proposed: ContextSuggestion[];
  /** The ones still on offer. Shrinks as they are inserted. */
  pending: ContextSuggestion[];
  /** Stage names the teacher accepted — the clearest signal of what they want. */
  inserted: string[];
  discarded: number;
  /** Why each dropped suggestion was dropped. */
  problems: string[];
  error: string;
  status: "running" | "done" | "failed" | "stopped";
};

/** What the agent said, as it will read it back on the next turn.
 *
 *  Written as prose rather than replayed as the original `tool_use` block: the
 *  API pairs a tool call with a tool result, and there is no result to give —
 *  the "result" is a teacher deciding, over the following minutes, which slides
 *  to keep. Saying which ones they kept is both simpler and more useful. */
function summarise(turn: Turn): string {
  // It proposed nothing and said why. Replay the why, so a follow-up — "the
  // context is empty, work from the lesson itself then" — lands on a model that
  // remembers what it just told the teacher.
  if (turn.proposed.length === 0) {
    return turn.answer || "I had nothing to suggest from what I could see.";
  }

  // Frozen the moment the turn lands. It used to say which suggestions the
  // teacher had inserted — written into the turn that PROPOSED them, minutes
  // later, as they were accepted one by one. Every one of those edits rewrote a
  // message the cache had already been keyed on, so the conversation the
  // function had carefully arranged to read from cache was re-sent at full price
  // on the next turn. Which ones were taken is still told to the model; it now
  // travels on the new message, where it changes nothing behind it.
  const lines = turn.proposed.map((suggestion) => {
    const kinds = suggestion.blocks.map((block) => block.type).join(", ");
    return `- "${suggestion.stage}" (${kinds}, after ${suggestion.afterSlideId})`;
  });

  return ["I proposed:", ...lines].join("\n");
}

/** The conversation so far, oldest first, trimmed to what travels. */
function toHistory(turns: Turn[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const turn of turns) {
    if (turn.status !== "done") continue;
    messages.push({
      role: "user",
      content: turn.sent || "(no particular steer — use your judgement)",
    });
    messages.push({ role: "assistant", content: summarise(turn) });
  }
  return messages.slice(-HISTORY_LIMIT);
}

/**
 * Claude's proposals for this class, as a conversation.
 *
 * A real one: each turn carries the previous exchanges, so "not that one, do
 * Diego instead" or "shorter" is understood rather than answered from scratch.
 * That is also the cheap way round — the function puts its last cache breakpoint
 * on the message before the new question, so the class dossier, the lesson and
 * every earlier turn are read from cache instead of re-sent. A long conversation
 * costs less per turn than a short one, not more.
 *
 * What the agent is told about a past turn is what it proposed and which of those
 * the teacher actually inserted. The second half is the useful part: it is the
 * only feedback signal in the loop, and it comes for free.
 *
 * Nothing is applied on its own. The teacher is the one who knows whether a
 * suggestion built on a student's weak unit is fair or stale, and a slide that
 * appeared without being asked for is a slide nobody quite owns.
 */
export function AdvancedContextDrawer({
  kind = "lesson",
  groupId,
  documentId,
  groupName,
  slides,
  onInsert,
}: {
  /** Which of the group's three copies is being added to. It decides what the
   *  agent may propose — content blocks for what you project and what they
   *  read, exercises for what they hand in. */
  kind?: SuggestKind;
  groupId: string;
  /** The lesson id for a presentation or a material; the homework's slug for a
   *  homework. */
  documentId: string;
  groupName: string;
  /** For naming the anchor slide by its stage rather than its id. */
  slides: EditorSlide[];
  /** Adds the slide after its anchor. Returns false when the anchor is no longer
   *  in the document. */
  onInsert: (suggestion: ContextSuggestion) => boolean;
}) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");

  const abort = React.useRef<AbortController | null>(null);
  const bottom = React.useRef<HTMLDivElement | null>(null);
  /** The reasoning box of the turn currently running. Only one runs at a time,
   *  so one ref covers it. */
  const liveThinking = React.useRef<HTMLDivElement | null>(null);
  const nextId = React.useRef(0);
  /** Stage names already reported to the model as inserted. What the teacher
   *  accepts is the only feedback in the loop, and each acceptance is worth
   *  saying exactly once. */
  const announced = React.useRef<Set<string>>(new Set());
  // Read at send time, so the history sent is the state as it stands then —
  // including inserts made while the previous answer was on screen.
  const turnsRef = React.useRef<Turn[]>([]);
  turnsRef.current = turns;

  const running = turns.some((turn) => turn.status === "running");

  // Follow the transcript as it grows, and the reasoning inside it — the box has
  // its own scroller, so scrolling the transcript alone would leave the newest
  // sentence just below its fold. A stream you have to keep scrolling yourself is
  // a stream you stop reading.
  React.useEffect(() => {
    const box = liveThinking.current;
    if (box) box.scrollTop = box.scrollHeight;
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // A drawer closed or unmounted mid-run shouldn't leave the model generating
  // tokens nobody will read.
  React.useEffect(() => () => abort.current?.abort(), []);

  const stageFor = (slideId: string) =>
    slides.find((slide) => slide.meta.id === slideId)?.meta.stage ?? slideId;

  const patch = (id: number, changes: Partial<Turn>) =>
    setTurns((list) =>
      list.map((turn) => (turn.id === id ? { ...turn, ...changes } : turn)),
    );

  const send = async () => {
    if (running) return;

    const prompt = draft.trim();
    const history = toHistory(turnsRef.current);

    // What they took since they last said anything, carried on this message
    // rather than backdated into the answer that proposed it.
    const news = turnsRef.current
      .flatMap((turn) => turn.inserted)
      .filter((stage) => !announced.current.has(stage));
    for (const stage of news) announced.current.add(stage);

    const sent =
      news.length === 0
        ? prompt
        : [
            prompt || "Suggest more advanced context — use your judgement.",
            `(Since your last answer I inserted: ${news
              .map((stage) => `“${stage}”`)
              .join(", ")}.)`,
          ].join("\n\n");
    const id = (nextId.current += 1);
    const controller = new AbortController();
    abort.current = controller;

    setDraft("");
    setTurns((list) => [
      ...list,
      {
        id,
        prompt,
        sent,
        thinking: "",
        answer: "",
        proposed: [],
        pending: [],
        inserted: [],
        discarded: 0,
        problems: [],
        error: "",
        status: "running",
      },
    ]);

    try {
      const result = await suggestAdvancedContext(kind, groupId, documentId, {
        teacherPrompt: sent || undefined,
        history,
        signal: controller.signal,
        onThinking: (delta) =>
          setTurns((list) =>
            list.map((turn) =>
              turn.id === id ? { ...turn, thinking: turn.thinking + delta } : turn,
            ),
          ),
      });
      patch(id, {
        answer: result.answer,
        proposed: result.suggestions,
        pending: result.suggestions,
        discarded: result.discarded,
        problems: result.problems,
        status: "done",
      });
    } catch (err) {
      // Stopping on purpose is not a failure — don't show the teacher an error
      // they caused.
      if (controller.signal.aborted) {
        patch(id, { status: "stopped" });
        return;
      }
      patch(id, { error: (err as Error).message, status: "failed" });
    }
  };

  const insert = (turnId: number, suggestion: ContextSuggestion) => {
    if (!onInsert(suggestion)) {
      alert(
        "That slide isn't in this document any more, so there's nowhere to anchor this one.",
      );
      return;
    }
    setTurns((list) =>
      list.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              pending: turn.pending.filter((s) => s !== suggestion),
              inserted: [...turn.inserted, suggestion.stage],
            }
          : turn,
      ),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 flex flex-row items-center justify-between space-y-1 border-b bg-popover px-5 py-3">
        <ClaudeLogo />
        <p className="text-xs font-montserrat text-muted-foreground">
          LexStudio Agent: Advanced Context
        </p>
        {/* <p className="truncate text-xs text-muted-foreground">{groupName}</p> */}
      </header>

      {/* Transcript */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {turns.length === 0 && (
          <div className="space-y-3 pt-6 text-center">
            <p className="font-display text-3xl lowercase leading-none tracking-tight text-primary">
              lexicon
            </p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground font-montserrat">
              {kind === "homework"
                ? "Ask for advanced context and it’ll come back as whole sets of exercises, each with the section it goes after and why it was proposed."
                : kind === "material"
                  ? "Ask for advanced context and it’ll come back as whole sections for this group to read, each with the one it goes after and why it was proposed."
                  : "Ask for advanced context and it’ll come back as whole slides, each with the slide it goes after and why it was proposed."}
            </p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground font-montserrat">
              Built from {groupName}’s context, each student’s notes, their
              progress reports, the homework they’ve handed in, and what this
              class has already been given.
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            {turn.prompt && (
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-sm">
                  {turn.prompt}
                </p>
              </div>
            )}

            {turn.status === "running" && <Working />}

            {/* Live while it runs, collapsed once it lands. Set as prose rather
                than as a log: this is the model weighing one student's homework
                against another's, and it reads like writing because it is. The
                reasoning is the audit trail for a suggestion, so it stays
                available — it just stops competing with the thing it was
                reasoning about. */}
            {turn.thinking &&
              (turn.status === "running" ? (
                <div
                  ref={liveThinking}
                  className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                >
                  {turn.thinking}
                </div>
              ) : (
                <details>
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Reasoning
                  </summary>
                  <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {turn.thinking}
                  </div>
                </details>
              ))}

            {turn.status === "stopped" && (
              <p className="text-xs text-muted-foreground">Stopped.</p>
            )}

            {turn.status === "failed" && (
              <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-medium">Couldn’t get suggestions.</p>
                <p className="text-xs text-muted-foreground">{turn.error}</p>
              </div>
            )}

            {/* What was dropped, and why. The reason is the whole point: a
                teacher told only that something was "malformed" asks again and
                gets the same answer back. */}
            {turn.problems.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                  {turn.discarded > 0
                    ? `${turn.discarded} suggestion${
                        turn.discarded === 1 ? " was" : "s were"
                      } left out:`
                    : "Some of what came back didn’t survive the check:"}
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  {turn.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}

            {turn.answer && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {turn.answer}
              </p>
            )}

            {turn.status === "done" &&
              turn.proposed.length === 0 &&
              // It said why, in its own words. That IS the answer — don't follow
              // it with a canned guess about which field to go and fill in.
              !turn.answer &&
              // Only when the answer really was empty. Everything having been
              // rejected is a different fact, and telling the teacher to go
              // write more context would send them off to fix the wrong thing.
              (turn.discarded === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing to suggest — which is a real answer. Fill in the
                  class’s context, a unit report or two, or mark some homework,
                  and ask again.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Everything it proposed this turn was rejected on the way in.
                  Ask again — saying what to change, if the reason above says
                  what.
                </p>
              ))}

            {turn.pending.map((suggestion, index) => (
              <article
                key={index}
                className="space-y-3 rounded-2xl border bg-card p-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">{suggestion.stage}</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    after {stageFor(suggestion.afterSlideId)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.rationale}
                  </p>
                </div>

                {/* The real renderers, not a description of them: what you
                    approve should be the thing that lands. */}
                <div className="pointer-events-none rounded-2xl border bg-background p-4 text-sm">
                  <AdvancedMark />
                  <div className="space-y-6">
                    {suggestion.blocks.map((block, i) => (
                      <BlockView key={i} block={block} audience="teacher" />
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => insert(turn.id, suggestion)}
                >
                  <PlusIcon />
                  Insert slide
                </Button>
              </article>
            ))}

            {turn.inserted.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Inserted {turn.inserted.map((stage) => `“${stage}”`).join(", ")}.
              </p>
            )}
          </div>
        ))}

        <div ref={bottom} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-popover px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/30">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the convention every
              // chat box has trained everyone into.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            disabled={running}
            placeholder={
              turns.length === 0
                ? "Ask for advanced context, or just send…"
                : "Ask a follow-up…"
            }
            className={cn(
              "max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70",
              running && "opacity-60",
            )}
          />

          {running ? (
            <Button
              size="icon"
              variant="outline"
              className="size-9 shrink-0 rounded-xl"
              onClick={() => abort.current?.abort()}
            >
              <SquareIcon />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-9 shrink-0 rounded-xl"
              onClick={() => void send()}
            >
              <ArrowUpIcon />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
