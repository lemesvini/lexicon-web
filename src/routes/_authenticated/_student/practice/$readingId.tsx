import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BookOpenTextIcon,
  CheckCheckIcon,
  RotateCcwIcon,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { OptionButton, optionState } from "@/features/blocks/exercise-ui";
import {
  LEVEL_LABEL,
  findReading,
  nextReading,
  type Reading,
} from "@/features/practice/data/readings";
import { usePracticeScores } from "@/features/practice/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_student/practice/$readingId")({
  loader: ({ params }) => {
    const reading = findReading(params.readingId);
    if (!reading) throw notFound();
    return { reading, next: nextReading(params.readingId) };
  },
  component: ReadingPage,
  notFoundComponent: () => (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/practice" backLabel="Back to practice" align="mid" />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="rounded-xl border bg-card p-6 font-montserrat text-sm text-muted-foreground">
          Esse texto não existe. Volte para a lista e escolha outro.
        </p>
      </main>
    </div>
  ),
});

/**
 * One text, then its questions, then the verdict.
 *
 * All the questions at once rather than the homework's one-at-a-time stepper:
 * a comprehension question is answered by looking back at the text, and a
 * student scrolling between the two should not also be paging. Nothing is
 * marked until every question is answered and the student asks — an answer
 * that turns red the moment it is tapped teaches guessing, not reading.
 */
function ReadingPage() {
  const { reading, next } = Route.useLoaderData();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/practice" backLabel="Back to practice" align="narrow" />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
        <Header reading={reading} />
        <Passage reading={reading} />
        {/* Keyed on the id so moving to the next text starts a clean attempt. */}
        <Quiz key={reading.id} reading={reading} next={next} />
      </main>
    </div>
  );
}

function Header({ reading }: { reading: Reading }) {
  return (
    <header className="space-y-1">
      <p className="font-montserrat text-[0.6875rem] font-medium tracking-[0.14em] text-primary uppercase">
        {reading.level} · {LEVEL_LABEL[reading.level]}
      </p>
      <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
        {reading.title}
      </h1>
      <p className="font-montserrat text-sm text-muted-foreground">
        {reading.blurb}
      </p>
    </header>
  );
}

/** The text itself. A size up from the app's body copy and set loose — this is
 *  the one thing on the page that is read rather than scanned. */
function Passage({ reading }: { reading: Reading }) {
  return (
    <article className="space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-xs sm:p-8">
      <p className="flex items-center gap-2 font-montserrat text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <BookOpenTextIcon className="size-3.5" />
        Read the text
      </p>
      {reading.paragraphs.map((paragraph, i) => (
        <p key={i} className="font-montserrat text-lg leading-relaxed">
          {paragraph}
        </p>
      ))}
    </article>
  );
}

function Quiz({ reading, next }: { reading: Reading; next?: Reading }) {
  const { record } = usePracticeScores();
  const [chosen, setChosen] = React.useState<(number | null)[]>(() =>
    reading.questions.map(() => null),
  );
  const [revealed, setRevealed] = React.useState(false);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const total = reading.questions.length;
  const answered = chosen.filter((c) => c !== null).length;
  const correct = reading.questions.filter(
    (q, i) => chosen[i] === q.answer,
  ).length;

  const choose = (question: number, option: number) => {
    if (revealed) return;
    setChosen((prev) => prev.map((c, i) => (i === question ? option : c)));
  };

  const check = () => {
    setRevealed(true);
    record(reading.id, { correct, total });
  };

  const restart = () => {
    setChosen(reading.questions.map(() => null));
    setRevealed(false);
  };

  // The verdict lands below the last question, off-screen on most phones —
  // so it is brought up rather than left for the student to go looking for.
  React.useEffect(() => {
    if (revealed) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [revealed]);

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">Questions</h2>
        <span className="font-montserrat text-sm text-muted-foreground tabular-nums">
          {answered} of {total} answered
        </span>
      </div>

      <ol className="space-y-6">
        {reading.questions.map((question, qi) => (
          <li
            key={qi}
            className="space-y-3 rounded-xl border bg-card p-5 text-card-foreground shadow-xs"
          >
            <p className="flex gap-3 font-montserrat font-medium">
              <span className="text-primary tabular-nums">{qi + 1}.</span>
              <span>{question.prompt}</span>
            </p>
            <ul className="space-y-2">
              {question.options.map((option, oi) => (
                <li key={oi}>
                  <OptionButton
                    state={optionState({
                      index: oi,
                      chosen: chosen[qi],
                      correct: revealed ? question.answer : null,
                      revealed,
                    })}
                    disabled={revealed}
                    onClick={() => choose(qi, oi)}
                  >
                    <span className="mr-2 font-montserrat text-sm text-muted-foreground">
                      {String.fromCharCode(97 + oi)})
                    </span>
                    {option}
                  </OptionButton>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {revealed ? (
        <Result
          ref={resultRef}
          correct={correct}
          total={total}
          next={next}
          onRestart={restart}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Button size="lg" onClick={check} disabled={answered < total}>
            <CheckCheckIcon />
            Check answers
          </Button>
          {answered < total && (
            <p className="font-montserrat text-xs text-muted-foreground">
              Responda todas as perguntas para conferir.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** The score, and the two ways on from it: again, or the next text. */
function Result({
  ref,
  correct,
  total,
  next,
  onRestart,
}: {
  ref: React.Ref<HTMLDivElement>;
  correct: number;
  total: number;
  next?: Reading;
  onRestart: () => void;
}) {
  const perfect = correct === total;
  const good = correct >= Math.ceil(total * 0.6);

  const line = perfect
    ? "Perfeito! Você entendeu tudo."
    : good
      ? "Muito bem. Dê uma olhada nas que errou."
      : "Vale reler o texto com calma e tentar de novo.";

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border p-6 text-center",
        perfect
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-primary/15 bg-primary/10",
      )}
    >
      <div>
        <p className="font-display text-4xl text-primary tabular-nums">
          {correct} / {total}
        </p>
        <p className="mt-1 font-montserrat text-sm text-muted-foreground">
          {line}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcwIcon />
          Try again
        </Button>
        {next ? (
          <Button asChild>
            <Link to="/practice/$readingId" params={{ readingId: next.id }}>
              Next text
              <ArrowRightIcon />
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/practice">
              All texts
              <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
