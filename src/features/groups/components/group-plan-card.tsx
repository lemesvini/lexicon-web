import * as React from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
  FolderIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addGroupLessons,
  regenerateDates,
  type GroupLessonRow,
} from "@/features/groups/data/group-lessons";
import {
  setGroupContext,
  setGroupModule,
  type GroupRow,
  type GroupStudentContext,
} from "@/features/groups/data/groups";
import { setStudentNotes } from "@/features/students/data/student-profile";
import type { ModuleRow } from "@/features/modules/data/modules";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { cn } from "@/lib/utils";

/**
 * What this class is, and the two facts everything on the page is laid out from.
 *
 * The description is the group's own context — the same free text the advanced
 * editor writes (`groups.context`, migration 0010): who they are, what they are
 * for, what keeps going wrong. Two lines of it here and the rest behind a
 * drawer, because it is read far more often than it is written: it is one of the
 * three things the block suggestions are built from, so what matters on this
 * page is seeing at a glance whether there is any.
 *
 * The module is a card of its own, and the same folder tile it is in the
 * modules gallery — it is not part of the description of the class, it is the
 * course everything below is a copy of. The start date rides in its corner
 * because the only thing that date does is lay that module's lessons out.
 */
export function GroupStudioCard({
  group,
  students,
  rows,
  missing,
  modules,
  moduleId,
  classCount,
  onModuleChange,
  startDate,
  onStartDateChange,
  busy,
  run,
  onChanged,
}: {
  group: GroupRow;
  /** The group's students and the note kept on each — the context panel's
   *  second half, and what the line under the description counts. */
  students: GroupStudentContext[];
  /** The copies this group already has — what the two apply buttons act on. */
  rows: GroupLessonRow[];
  /** Lessons in the chosen module this group hasn't copied yet. */
  missing: CloudLessonSummary[];
  modules: ModuleRow[];
  moduleId: string;
  /** How many lessons the chosen module holds — the tile's "24 classes". */
  classCount: number;
  onModuleChange: (moduleId: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  busy: boolean;
  /** The page's write-then-reload wrapper. */
  run: (action: () => Promise<void>) => void;
  /** Re-reads the page. Called after a note is saved in the panel, which is a
   *  write the page's own lists don't make. */
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const chosenModule = modules.find((module) => module.id === moduleId);

  return (
    // No `items-start`: the three cards share a row, so they share its height.
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
        <h2 className="font-display text-2xl  text-primary">
          Studio<span className="font-montserrat">Context</span>
        </h2>

        {/* The context is the description, and pressing it is how you write it.
            A button rather than a field: this is prose, and a two-line preview
            of it is not somewhere to type. */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group/context block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <p
            className={cn(
              "line-clamp-2 text-sm leading-relaxed transition-colors group-hover/context:text-foreground",
              group.context ? "text-muted-foreground" : "text-muted-foreground/70 italic",
            )}
          >
            {group.context ||
              `Nothing written about ${group.name} yet — who they are, what they're for, what keeps going wrong.`}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
            <PencilIcon className="size-3" />
            {group.context ? "Read and edit" : "Write the class context"}
          </span>

          {/* The other half of what the suggestions read. A group's context
              describes the room; a student's describes the student, and one
              nobody has written is the commonest reason advice comes back
              generic — so the gap is counted where it can be fixed. */}
          <span className="mt-3 block text-xs text-muted-foreground">
            {studentContextSummary(students)}
          </span>
        </button>
      </section>

      {/* The module as the folder tile it is everywhere else in the app (see
          the homepage's ModuleCard), with the two things this page does to it
          on board: the date the plan starts from, top right, and the press that
          copies what's missing. */}
      <section className="relative flex min-h-44 w-full max-w-[18rem] flex-col justify-between gap-6 overflow-hidden rounded-xl border border-primary/15 bg-primary/10 p-4 text-primary shadow-sm lg:max-w-none">
        <div className="flex items-start justify-between gap-2">
          <FolderIcon className="size-6 opacity-90" />

          <div className="flex items-center gap-1">
            <Label htmlFor="group-start-date" className="sr-only">
              Starting
            </Label>
            <Input
              id="group-start-date"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              title="The date the plan is laid out from"
              className="h-8 w-[8.5rem] border-primary/25 bg-background/60 text-xs"
            />

            {/* Re-space every copy from that date. Hidden when there is nothing
                to space — no copies, or no meeting days to lay them on. */}
            {rows.length > 0 && group.meetsOn.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                title="Re-space every planned date from this one"
                aria-label="Re-space every planned date from this one"
                className="text-primary hover:bg-primary/15"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Re-space every date from the start date? Any date you set by hand is overwritten.",
                    )
                  ) {
                    return;
                  }
                  run(() => regenerateDates(group.id, group.meetsOn, startDate));
                }}
              >
                <CalendarPlusIcon />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          {/* The name is the control. With no module chosen there is no name to
              draw — an empty tile you press is the honest shape of "this group
              hasn't been given a course yet". */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <h3 className="line-clamp-3 break-words font-display text-xl leading-tight tracking-tight sm:text-2xl">
                  {chosenModule?.name ?? ""}
                </h3>
                <p className="text-sm opacity-80">
                  {chosenModule
                    ? `${classCount} class${classCount === 1 ? "" : "es"}`
                    : "Pick a module"}
                </p>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onSelect={() => {
                  onModuleChange("");
                  run(() => setGroupModule(group.id, null));
                }}
              >
                No module set
              </DropdownMenuItem>
              {modules.map((module) => (
                <DropdownMenuItem
                  key={module.id}
                  onSelect={() => {
                    onModuleChange(module.id);
                    run(() => setGroupModule(group.id, module.id));
                  }}
                >
                  {module.id === moduleId && <CheckIcon />}
                  {module.name}
                  {module.isActive ? "" : " (inactive)"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Only while the chosen module has lessons this group hasn't got.
              Picking a module doesn't copy anything on its own — that is
              deliberate, and this is the press that does it. It goes once there
              is nothing left to add, which is also how you can tell. */}
          {missing.length > 0 && (
            <Button
              size="icon-sm"
              disabled={busy}
              title={`Add ${missing.length} lesson${missing.length === 1 ? "" : "s"} to this group`}
              aria-label={`Add ${missing.length} lesson${missing.length === 1 ? "" : "s"} to this group`}
              className="shrink-0"
              onClick={() =>
                run(async () => {
                  await addGroupLessons(group.id, missing, {
                    meetsOn: group.meetsOn,
                    startDate,
                  });
                })
              }
            >
              <PlusIcon />
            </Button>
          )}
        </div>
      </section>

      <GroupContextDrawer
        // Keyed on the stored text: the group row is re-read after every write
        // on this page, and a drawer opened onto somebody else's edit should
        // show it rather than sit on a stale draft.
        key={group.context}
        group={group}
        students={students}
        open={editing}
        onOpenChange={setEditing}
        onSaved={onChanged}
      />
    </div>
  );
}

/**
 * The group's context, at the length it is actually written in.
 *
 * Explicit save, no autosave: this is prose somebody is in the middle of
 * writing, and half a sentence is not a fact about the class. Saved on its own
 * rather than through the page's `run` — reloading every list on the page is a
 * heavy answer to a paragraph of text.
 */
function GroupContextDrawer({
  group,
  students,
  open,
  onOpenChange,
  onSaved,
}: {
  group: GroupRow;
  students: GroupStudentContext[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [context, setContext] = React.useState(group.context);
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");

  const dirty = context !== group.context;

  const save = async () => {
    setState("saving");
    try {
      await setGroupContext(group.id, context);
      onSaved();
      setState("saved");
      window.setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("idle");
      alert(`Could not save the class context: ${(err as Error).message}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg">
        <SheetHeader>
          <SheetTitle>About {group.name}</SheetTitle>
          <SheetDescription>
            Who they are, what they’re for, what keeps going wrong. This is one
            of the three things the block suggestions are built from — the
            others are each student’s notes and their unit reports.
          </SheetDescription>
        </SheetHeader>

        {/* One scroller for both halves: the class and the students in it are
            one thought, and two panes would make the students the thing you
            scroll past rather than the thing you read next. */}
        <div className="no-scrollbar -mx-6 min-h-0 flex-1 space-y-6 overflow-y-auto px-6">
          <div className="space-y-2">
            <AutoTextarea
              value={context}
              onChange={setContext}
              minRows={6}
              placeholder="Two teenagers and an adult, all three sitting the B1 exam in November. Confident speakers, but they avoid the past perfect entirely…"
            />
            <div className="flex justify-end">
              <Button
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

          <div className="space-y-3 border-t pt-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-medium">The students</h3>
              <p className="text-xs text-muted-foreground">
                Each student’s own note — the same one their profile carries.
                Written here because this is where you are thinking about the
                class, and because a suggestion is only as particular as these
                are.
              </p>
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nobody on the roster for this group yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {students.map((student) => (
                  <li key={student.studentId}>
                    <StudentContextField
                      // Keyed on the saved text for the same reason the drawer
                      // is: a re-read that found somebody else's edit should
                      // show it, and it only changes when the save does.
                      key={student.notes}
                      student={student}
                      onSaved={onSaved}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One student's note, saved on its own. Same bargain as the group's: explicit
 *  save, because half a sentence about a person is not a fact about them. */
function StudentContextField({
  student,
  onSaved,
}: {
  student: GroupStudentContext;
  onSaved: () => void;
}) {
  const [notes, setNotes] = React.useState(student.notes);
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");

  const dirty = notes !== student.notes;

  const save = async () => {
    setState("saving");
    try {
      await setStudentNotes(student.studentId, notes);
      onSaved();
      setState("saved");
      window.setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("idle");
      alert(`Could not save the note: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium">
          {student.name || "Unnamed student"}
        </p>
        {!student.notes && !dirty && (
          <span className="shrink-0 text-xs text-muted-foreground">
            No context yet
          </span>
        )}
      </div>

      <AutoTextarea
        value={notes}
        onChange={setNotes}
        minRows={2}
        placeholder={`What ${student.name.split(" ")[0] || "they"} is working on, and what keeps getting in the way.`}
      />

      {(dirty || state !== "idle") && (
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
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * How much of the class the agent can actually see, as a fraction.
 *
 * A count rather than a sentence about what is missing: this sits under the
 * group's own context, where the question being answered is "how much is
 * written down?", and 1 of 4 says that at a glance in a way that "three
 * students have no context yet" makes you work out.
 */
function studentContextSummary(students: GroupStudentContext[]): string {
  if (students.length === 0) return "No students on this group yet";

  const written = students.filter((student) => student.notes.trim()).length;
  return `${written} of ${students.length} student context${
    students.length === 1 ? "" : "s"
  } available`;
}

/**
 * A textarea the height of whatever is in it.
 *
 * The notes here are not all the same size — a line about one student, and a
 * whole onboarding transcript about another — and a fixed box turns the long
 * ones into a two-line window with a scrollbar down the side of the text. Grow
 * instead: the panel is already the thing that scrolls.
 *
 * Measured in a layout effect rather than with `field-sizing: content`, which
 * Safari does not have yet. `height: auto` first is load-bearing — `scrollHeight`
 * of an element already taller than its content reports the old height, so
 * without it the box grows and never shrinks.
 */
function AutoTextarea({
  value,
  onChange,
  minRows,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  minRows: number;
  placeholder: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={minRows}
      placeholder={placeholder}
      className="no-scrollbar block w-full resize-none overflow-hidden rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
    />
  );
}
