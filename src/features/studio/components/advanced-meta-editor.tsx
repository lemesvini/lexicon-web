import * as React from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setGroupContext } from "@/features/groups/data/groups";
import type { GroupRow } from "@/features/groups/data/groups";

/**
 * What this copy is, and who it is for.
 *
 * The lesson's own fields aren't editable here — a group's copy carries the
 * shared lesson's title and unit, and letting one class rename it would only make
 * the same lesson answer to two names.
 *
 * The class context is editable, and sits here rather than only on the group
 * page, because this is where its absence is felt: it is one of the three things
 * the suggestions are built from, and an empty one is the difference between
 * advice about this room and advice about the lesson in the abstract.
 */
export function AdvancedMetaEditor({
  group,
  lessonTitle,
  lessonUnit,
  scheduledOn,
}: {
  group: GroupRow;
  lessonTitle: string;
  lessonUnit: string;
  scheduledOn: string | null;
}) {
  const [context, setContext] = React.useState(group.context);
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");

  const dirty = context !== group.context;

  const save = async () => {
    setState("saving");
    try {
      await setGroupContext(group.id, context);
      setState("saved");
      window.setTimeout(() => setState("idle"), 1500);
    } catch (err) {
      setState("idle");
      alert(`Could not save the class context: ${(err as Error).message}`);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Advanced context · {group.name}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {lessonTitle || "Untitled lesson"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[lessonUnit, group.moduleName, scheduledOn]
            .filter(Boolean)
            .join(" · ") || "No unit or date set"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-context">About this class</Label>
        <textarea
          id="group-context"
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={4}
          placeholder="Who they are, what they're for, what keeps going wrong. This is what the suggestions are built from."
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
        />
        {/* Explicit save, no autosave: this is prose somebody is in the middle of
            writing, and half a sentence is not a fact about the class. */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || state === "saving"}
            onClick={() => void save()}
          >
            {state === "saving" ? (
              <Loader2Icon className="animate-spin" />
            ) : state === "saved" ? (
              <CheckIcon />
            ) : null}
            {state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Saved"
                : "Save context"}
          </Button>
        </div>
      </div>

      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        The slides below are the shared lesson — you can add to them, but not
        change or remove them. Anything you add is marked{" "}
        <span className="font-medium text-primary">Advanced Context</span> and is
        only ever seen by {group.name}.
      </p>
    </section>
  );
}
