import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addGroupStudent } from "@/features/groups/data/groups";
import type { StudentRow } from "@/features/students/data/students";

/**
 * Puts students into a group. A filterable list rather than a picker, because
 * adding six people one dialog at a time is the tedious version of the same job:
 * each row adds on click and drops out of the list, so a whole group goes in
 * without the dialog closing.
 *
 * Only students already on the register are excluded. An inactive student is
 * still offered — they're inactive on the roster, not necessarily out of the
 * class you're building.
 */
export function AddMemberDialog({
  groupId,
  groupName,
  students,
  memberIds,
  onAdd,
}: {
  groupId: string;
  groupName: string;
  /** Every student the caller can see — already scoped by the roster's RLS. */
  students: StudentRow[];
  /** Who is on the register now, so they aren't offered twice. */
  memberIds: Set<string>;
  /** Called after each successful add, so the register can reload. */
  onAdd: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Kept as two steps so the empty state can tell "everyone is already in" from
  // "your filter matched nobody" — which are different problems.
  const addable = React.useMemo(
    () => students.filter((student) => !memberIds.has(student.id)),
    [students, memberIds],
  );

  const available = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return addable;
    return addable.filter(
      (student) =>
        student.name.toLowerCase().includes(needle) ||
        student.email.toLowerCase().includes(needle),
    );
  }, [addable, query]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    setQuery("");
    setError(null);
  };

  const add = async (studentId: string) => {
    setBusyId(studentId);
    setError(null);
    try {
      await addGroupStudent(groupId, studentId);
      onAdd();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon />
          Add student
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {groupName}</DialogTitle>
          <DialogDescription>
            Click a student to put them on the register. Stays open, so you can
            add the whole group.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <Input
            placeholder="Filter students..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="no-scrollbar max-h-72 divide-y overflow-y-auto rounded-md border">
            {available.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {addable.length === 0
                  ? "Everyone on your roster is already in this group."
                  : "No students match."}
              </p>
            ) : (
              available.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void add(student.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {student.name || student.email}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {student.module}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {busyId === student.id ? "Adding…" : "Add"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
