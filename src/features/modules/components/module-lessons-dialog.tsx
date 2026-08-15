import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  setLessonsModule,
  UNASSIGNED,
  type AssignableLesson,
  type ModuleRow,
} from "@/features/modules/data/modules";

/**
 * Picks which lessons belong to a module.
 *
 * A lesson lives in exactly one module — `lessons.module` holds a single name —
 * so ticking one here takes it out of wherever it was. The row says which module
 * that is, rather than letting the move happen silently.
 */
export function ModuleLessonsDialog({
  module,
  lessons,
  open,
  onOpenChange,
  onSaved,
}: {
  module: ModuleRow;
  /** Every lesson in the library, not just this module's. */
  lessons: AssignableLesson[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lessons in {module.name}</DialogTitle>
          <DialogDescription>
            Tick the lessons this module contains. A lesson can only be in one
            module, so ticking it here moves it out of its current one.
          </DialogDescription>
        </DialogHeader>

        {/* The draft lives in here on purpose: Radix unmounts the dialog's
            content when it closes, so reopening starts from what is actually in
            the module now rather than from an abandoned draft. */}
        <LessonPicker
          module={module}
          lessons={lessons}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

/** The checkbox list and its unsaved selection. Nothing is written until Save. */
function LessonPicker({
  module,
  lessons,
  onClose,
  onSaved,
}: {
  module: ModuleRow;
  lessons: AssignableLesson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = React.useMemo(
    () =>
      new Set(
        lessons
          .filter((lesson) => lesson.module.trim() === module.name)
          .map((lesson) => lesson.id),
      ),
    [lessons, module.name],
  );

  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return lessons;
    return lessons.filter((lesson) =>
      `${lesson.title} ${lesson.unit} ${lesson.module}`
        .toLowerCase()
        .includes(needle),
    );
  }, [lessons, query]);

  const toggle = (lessonId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lessonId);
      else next.delete(lessonId);
      return next;
    });
  };

  const added = [...selected].filter((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !selected.has(id));
  const dirty = added.length > 0 || removed.length > 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // Removals first: a lesson moving out and another moving in are separate
      // calls, and this order never leaves a lesson counted in two modules.
      await setLessonsModule(removed, UNASSIGNED);
      await setLessonsModule(added, module.name);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <Input
        placeholder="Filter lessons..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="max-h-72 overflow-y-auto rounded-md border">
        {visible.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {lessons.length === 0
              ? "There are no lessons in the library yet."
              : "No lessons match."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((lesson) => {
              const currentModule = lesson.module.trim();
              const elsewhere =
                currentModule !== "" && currentModule !== module.name;

              return (
                <li key={lesson.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(lesson.id)}
                      onCheckedChange={(checked) =>
                        toggle(lesson.id, checked === true)
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {lesson.title || lesson.id}
                      </span>
                      {lesson.unit && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {lesson.unit}
                        </span>
                      )}
                    </span>
                    {elsewhere && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-muted-foreground"
                      >
                        {currentModule}
                      </Badge>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {dirty
          ? `${added.length} to add, ${removed.length} to remove.`
          : `${initial.size} lesson${initial.size === 1 ? "" : "s"} in this module.`}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={() => void save()}
          disabled={busy || !dirty}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
