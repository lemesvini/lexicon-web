import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContextNote } from "@/features/learn/data/student-context";
import { cn } from "@/lib/utils";

/** What the database will take (0021), so the form can say so first. */
const MAX_TITLE = 120;
const MAX_BODY = 2000;

/**
 * The student writing something into their own context.
 *
 * Append-only, and the form says as much: what goes in is dated and stays, the
 * way the onboarding answers do. A student who wants something taken out talks
 * to their teacher — the column this lands in is shared with the teacher's own
 * notes, and nothing here is allowed to touch those.
 */
export function ContextNoteForm({
  onSaved,
  onCancel,
}: {
  /** The note is in the database; the page should reload its list. */
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = title.trim().length > 0 && body.trim().length > 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || saving) return;

    setSaving(true);
    setError(null);
    try {
      await addContextNote(title.trim(), body.trim());
      onSaved();
    } catch {
      setSaving(false);
      setError("Não foi possível salvar. Tente de novo.");
    }
  };

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
    >
      <div className="space-y-1">
        <label
          htmlFor="context-note-title"
          className="font-montserrat text-sm font-medium"
        >
          Sobre o que é?
        </label>
        <Input
          id="context-note-title"
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Vou viajar a trabalho em novembro"
          className="border font-montserrat"
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="context-note-body"
          className="font-montserrat text-sm font-medium"
        >
          Conte para o seu professor
        </label>
        <textarea
          id="context-note-body"
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="O que mudou, o que você quer praticar, o que está difícil…"
          className={cn(
            "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 font-montserrat text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm dark:bg-input/30",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        />
        <p className="text-right font-montserrat text-xs text-muted-foreground">
          {body.length}/{MAX_BODY}
        </p>
      </div>

      {error && (
        <p className="font-montserrat text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!ready || saving}>
          {saving && <Loader2Icon className="animate-spin" />}
          Salvar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </Button>
        <p className="ml-auto font-montserrat text-xs text-muted-foreground">
          Fica salvo com a data de hoje e não pode ser apagado.
        </p>
      </div>
    </form>
  );
}
