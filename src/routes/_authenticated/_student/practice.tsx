import { createFileRoute } from "@tanstack/react-router";
import { DumbbellIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { BookCard } from "@/features/learn/components/book-card";

export const Route = createFileRoute("/_authenticated/_student/practice")({
  component: PracticePage,
});

/**
 * Practice — nothing behind it yet.
 *
 * The route exists ahead of the thing so the home screen can show all four
 * cards as one set: a card that appears later moves the three beside it, and a
 * page that says "not yet" is a straighter answer than a card that does nothing
 * when pressed.
 */
function PracticePage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to home" align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <BookCard
          icon={DumbbellIcon}
          eyebrow="Prática"
          title="Em breve"
          meta="Exercícios para praticar entre as aulas"
        />

        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-12 text-center">
          <p className="font-montserrat text-sm text-muted-foreground">
            Ainda estamos preparando esta parte.
          </p>
          <p className="font-montserrat text-sm text-muted-foreground">
            Enquanto isso, suas aulas e tarefas continuam na tela inicial.
          </p>
        </div>
      </main>
    </div>
  );
}
