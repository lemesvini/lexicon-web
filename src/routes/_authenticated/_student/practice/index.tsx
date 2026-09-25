import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, ChevronRightIcon, DumbbellIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { BookCard } from "@/features/learn/components/book-card";
import {
  LEVELS,
  LEVEL_LABEL,
  READINGS,
  type Reading,
} from "@/features/practice/data/readings";
import { usePracticeScores, type Score } from "@/features/practice/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_student/practice/")({
  component: PracticePage,
});

/**
 * The reading shelf: every text in the library, grouped by level, easiest
 * first.
 *
 * All levels are shown to every student rather than only their own. Practice
 * is the one place in the app with no teacher in it, and a student who wants
 * to peek a level up — or drop one down on a tired evening — should be let.
 * The level headings are the guidance; the list is the freedom.
 */
function PracticePage() {
  const { scores } = usePracticeScores();

  const done = READINGS.filter((reading) => scores[reading.id]).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to home" align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
        <BookCard
          icon={DumbbellIcon}
          eyebrow="Prática"
          title="Reading"
          meta={`${done} de ${READINGS.length} ${READINGS.length === 1 ? "texto" : "textos"}`}
        />

        <p className="font-montserrat text-sm text-muted-foreground">
          Leia o texto e responda às perguntas. Comece pelo seu nível — mas
          nada impede de espiar o próximo.
        </p>

        {LEVELS.map((level) => {
          const readings = READINGS.filter((r) => r.level === level);
          if (readings.length === 0) return null;
          return (
            <section key={level} className="space-y-3">
              <h2 className="flex items-baseline gap-2">
                <span className="font-display text-2xl text-primary">
                  {level}
                </span>
                <span className="font-montserrat text-sm text-muted-foreground">
                  {LEVEL_LABEL[level]}
                </span>
              </h2>
              <div className="space-y-3">
                {readings.map((reading, i) => (
                  <ReadingCard
                    key={reading.id}
                    reading={reading}
                    index={i + 1}
                    score={scores[reading.id]}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

/** One text on the shelf. The same card as a lesson in `my-lessons`, with the
 *  best score in the corner once there is one. */
function ReadingCard({
  reading,
  index,
  score,
}: {
  reading: Reading;
  index: number;
  score?: Score;
}) {
  const perfect = score && score.correct === score.total;

  return (
    <Link
      to="/practice/$readingId"
      params={{ readingId: reading.id }}
      className={cn(
        "group flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        "transition-all hover:border-primary/30 hover:shadow-md",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border font-display text-lg",
          perfect
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-primary/15 bg-primary/10 text-primary",
        )}
      >
        {perfect ? <CheckIcon className="size-5" /> : index}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-montserrat font-medium">
          {reading.title}
        </span>
        <span className="block truncate font-montserrat text-sm text-muted-foreground">
          {reading.blurb}
        </span>
      </span>

      {score && (
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-montserrat text-xs font-medium text-primary tabular-nums">
          {score.correct}/{score.total}
        </span>
      )}

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
