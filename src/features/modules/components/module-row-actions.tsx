import * as React from "react";
import {
  BookOpenIcon,
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleDialog } from "@/features/modules/components/module-dialog";
import { ModuleLessonsDialog } from "@/features/modules/components/module-lessons-dialog";
import {
  deleteModule,
  setModuleActive,
  setModuleOnDashboard,
  type AssignableLesson,
  type ModuleRow,
} from "@/features/modules/data/modules";

/**
 * Per-row module actions. The dialogs are siblings of the menu, not children —
 * a dialog inside a DropdownMenuItem unmounts as soon as the menu closes.
 */
export function ModuleRowActions({
  module,
  lessons,
  onChanged,
}: {
  module: ModuleRow;
  lessons: AssignableLesson[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [lessonsOpen, setLessonsOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const toggleActive = async () => {
    setBusy(true);
    try {
      await setModuleActive(module.id, !module.isActive);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleOnDashboard = async () => {
    setBusy(true);
    try {
      await setModuleOnDashboard(module.id, !module.showOnDashboard);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLessonsOpen(true)}
          disabled={busy}
        >
          <BookOpenIcon className="text-muted-foreground" />
          Lessons
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              <MoreHorizontalIcon />
              <span className="sr-only">Actions for {module.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <PencilIcon />
              Rename or reorder
            </DropdownMenuItem>
            {/* Separate from Activate: this one is only about the homepage's
                module gallery, not about who can be enrolled. */}
            <DropdownMenuItem onSelect={() => void toggleOnDashboard()}>
              {module.showOnDashboard ? <EyeOffIcon /> : <EyeIcon />}
              {module.showOnDashboard
                ? "Hide from dashboard"
                : "Show on dashboard"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleActive()}>
              {module.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ModuleLessonsDialog
        module={module}
        lessons={lessons}
        open={lessonsOpen}
        onOpenChange={setLessonsOpen}
        onSaved={onChanged}
      />

      <ModuleDialog
        module={module}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
      />

      <DeleteModuleDialog
        module={module}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onChanged}
      />
    </>
  );
}

/**
 * Confirms deleting a module.
 *
 * A real dialog rather than `window.confirm`: a native prompt fired from a
 * DropdownMenuItem's `onSelect` races the menu's own close, and it has nowhere
 * to put the reason when the database refuses.
 */
function DeleteModuleDialog({
  module,
  open,
  onOpenChange,
  onDeleted,
}: {
  module: ModuleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Caught here as well as in the RPC so the answer is immediate rather than a
  // round-trip. The RPC also refuses on past history, which this can't see —
  // that one comes back as `error`.
  const blocked = module.studentCount > 0;

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteModule(module.id);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await setModuleActive(module.id, false);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{module.name}”?</DialogTitle>
          <DialogDescription>
            {blocked ? (
              <>
                {module.studentCount} student
                {module.studentCount === 1 ? " is" : "s are"} in this module, so
                it can’t be deleted. Deactivating it hides it from the roster’s
                picker and keeps everyone’s access and history intact.
              </>
            ) : module.lessonCount > 0 ? (
              <>
                Its {module.lessonCount} lesson
                {module.lessonCount === 1 ? "" : "s"} will be left without a
                module — nothing is deleted from the library. This can’t be
                undone.
              </>
            ) : (
              <>This can’t be undone.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {blocked ? (
              <Button
                className="flex-1"
                onClick={() => void deactivate()}
                disabled={busy}
              >
                {busy ? "Working…" : "Deactivate instead"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
