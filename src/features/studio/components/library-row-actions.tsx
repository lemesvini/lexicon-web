import * as React from "react";
import {
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
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
import type { PublishStatus } from "../data/publishing";

/**
 * Publish, unpublish, delete — the actions a student-facing artifact has in the
 * library, shared by materials and homework.
 *
 * Publishing is one click with no confirmation and deleting is a dialog, which
 * is the right way round: publishing is instantly reversible from this same
 * menu, and deleting is not.
 */
export function LibraryRowActions({
  status,
  onSetStatus,
  onDelete,
  deleteTitle,
  deleteBody,
  onChanged,
}: {
  status: PublishStatus;
  onSetStatus: (status: PublishStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  deleteTitle: string;
  deleteBody: React.ReactNode;
  onChanged: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const published = status === "published";

  const toggle = async () => {
    setBusy(true);
    try {
      await onSetStatus(published ? "draft" : "published");
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={busy}>
            <MoreHorizontalIcon />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => void toggle()}>
            {published ? <EyeOffIcon /> : <EyeIcon />}
            {published ? "Unpublish" : "Publish"}
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

      {/* A sibling of the menu, not a child: a dialog rendered inside a
          DropdownMenuItem unmounts the moment the menu closes. */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTitle}
        body={deleteBody}
        onConfirm={onDelete}
        onDeleted={onChanged}
      />
    </>
  );
}

function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  body,
  onConfirm,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: React.ReactNode;
  onConfirm: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
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
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
