import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PlusIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCard } from "@/features/learn/components/book-card";
import { ContextNoteForm } from "@/features/learn/components/context-note-form";
import {
  fetchMyContext,
  type ContextBlock,
} from "@/features/learn/data/student-context";

export const Route = createFileRoute("/_authenticated/_student/my-context")({
  component: MyContextPage,
});

/**
 * What the school builds this student's classes around, in the student's own
 * words: the answers they gave at onboarding, and any later block written the
 * same way.
 *
 * Add-only, and only their own answers — see
 * @/features/learn/data/student-context for why the teacher's notes in the same
 * column are filtered out.
 *
 * A student can add to this and cannot edit or delete any of it (0021). What is
 * already here was true when it was said and the lessons built on it don't
 * rewrite themselves — so a change of circumstances is a new dated note, not an
 * answer quietly swapped for a different one.
 */
function MyContextPage() {
  const { access } = Route.useRouteContext();

  const [blocks, setBlocks] = React.useState<ContextBlock[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchMyContext()
      .then((rows) => {
        if (cancelled) return;
        setBlocks(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const answers = blocks.reduce((n, block) => n + block.answers.length, 0);

  const reload = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to home" align="mid" />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <BookCard
          icon={SparklesIcon}
          eyebrow="Meu contexto"
          title={access.fullName || "Você"}
          meta={
            status === "ready" && answers > 0
              ? `${answers} ${answers === 1 ? "resposta" : "respostas"} · base das suas aulas`
              : "No que suas aulas são baseadas"
          }
        />

        {adding ? (
          <ContextNoteForm
            onSaved={() => {
              setAdding(false);
              reload();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start rounded-xl border-dashed py-6 font-montserrat text-muted-foreground hover:text-foreground"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            Adicionar mais
          </Button>
        )}

        {status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border text-center">
            <p className="font-montserrat text-sm text-muted-foreground">
              Não foi possível carregar seu contexto.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
            >
              <RefreshCwIcon />
              Tentar de novo
            </Button>
          </div>
        ) : blocks.length === 0 ? (
          <div className="space-y-3 rounded-xl border bg-card p-6">
            <p className="font-montserrat text-sm text-muted-foreground">
              {access.onboardedAt
                ? "Nada por aqui ainda — suas respostas aparecem assim que seu professor as registrar."
                : "Responda o onboarding e suas respostas aparecem aqui."}
            </p>
            {!access.onboardedAt && (
              <Button asChild size="sm">
                <Link to="/onboarding">Começar onboarding</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, i) =>
              block.answers.map((entry, j) => (
                <article
                  key={`${i}-${j}`}
                  className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
                >
                  <p className="font-montserrat text-sm text-muted-foreground">
                    {entry.question}
                  </p>
                  <p className="mt-1 font-montserrat font-medium break-words whitespace-pre-line">
                    {entry.answer}
                  </p>
                </article>
              )),
            )}

            <p className="px-1 font-montserrat text-xs text-muted-foreground">
              {blocks[blocks.length - 1].title} · fale com seu professor se algo
              mudou.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
