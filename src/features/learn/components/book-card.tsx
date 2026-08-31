import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The book the student is in, at the top of the screens that list what's in it.
 *
 * The same jade tile as the home screen's cards (see dashboard-card), laid on
 * its side: a student who arrives here from one of those cards should feel they
 * opened it rather than left it. It goes nowhere when pressed — this is the
 * thing you are already inside, not another door.
 */
export function BookCard({
  icon: Icon,
  eyebrow,
  title,
  meta,
}: {
  icon: LucideIcon;
  /** What the card is for, in a word: "Meu módulo". */
  eyebrow: string;
  /** The module's name. A name, so it stays as the school wrote it. */
  title: string;
  /** The counts, already worded — "6 aulas · 2 a fazer". Sits out at the right
   *  edge, away from the name: it is the one thing on the card that changes. */
  meta?: string;
}) {
  return (
    <section
      className={cn(
        "flex items-center gap-4 rounded-xl border p-5 shadow-sm",
        "border-primary/15 bg-primary/10 text-primary",
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-black/5">
        <Icon className="size-6 opacity-90" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-montserrat text-[0.6875rem] font-medium tracking-[0.14em] uppercase opacity-70">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl leading-tight tracking-tight break-words sm:text-3xl">
          {title}
        </h1>
      </div>

      {meta && (
        <p className="ml-auto shrink-0 text-right font-montserrat text-sm opacity-80">
          {meta}
        </p>
      )}
    </section>
  );
}
