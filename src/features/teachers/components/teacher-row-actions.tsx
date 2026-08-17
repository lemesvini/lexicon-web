import * as React from "react";
import { KeyRoundIcon, MoreHorizontalIcon } from "lucide-react";

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
import { TempPasswordPanel } from "@/components/temp-password-panel";
import {
  resetTeacherPassword,
  setTeacherStatus,
  type TeacherRow,
} from "@/features/teachers/data/teachers";

/**
 * Per-row admin actions: issue a new temporary password, or lock the account.
 *
 * The admin's own row has none of them — there is no supported way to lock
 * yourself out of the school, and the menu shouldn't imply otherwise.
 *
 * The dialogs are siblings of the menu rather than children of it — a dialog
 * rendered inside a DropdownMenuItem is unmounted the moment the menu closes.
 */
export function TeacherRowActions({
  teacher,
  onChanged,
}: {
  teacher: TeacherRow;
  /** Called after any change lands, so the list can reload. */
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);

  if (teacher.isAdmin) return null;

  const isActive = teacher.status === "active";

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await setTeacherStatus(teacher.id, isActive ? "inactive" : "active");
      setConfirmOpen(false);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      const { tempPassword } = await resetTeacherPassword(teacher.id);
      setNewPassword(tempPassword);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              <MoreHorizontalIcon />
              <span className="sr-only">Actions for {teacher.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void resetPassword()}>
              <KeyRoundIcon />
              New temporary password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
              {isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Deactivate" : "Activate"} {teacher.name}
            </DialogTitle>
            <DialogDescription>
              {isActive ? (
                <>
                  They lose access to the app immediately.{" "}
                  {teacher.studentCount > 0 ? (
                    <>
                      Their {teacher.studentCount} student
                      {teacher.studentCount === 1 ? "" : "s"} stay on the roster —
                      you can still see them, but no other teacher can until you
                      hand them over.
                    </>
                  ) : (
                    <>Their lessons and corrections stay where they are.</>
                  )}
                </>
              ) : (
                <>They get their students and the teacher app back.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={isActive ? "destructive" : "default"}
              className="flex-1"
              onClick={() => void toggleStatus()}
              disabled={busy}
            >
              {busy ? "Saving…" : isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newPassword !== null}
        onOpenChange={(open) => !open && setNewPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New temporary password</DialogTitle>
            <DialogDescription>
              {teacher.name} can sign in with this until they set their own.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {newPassword && (
              <TempPasswordPanel email={teacher.email} password={newPassword} />
            )}
            <Button className="w-full" onClick={() => setNewPassword(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
