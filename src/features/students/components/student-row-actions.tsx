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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TempPasswordPanel } from "@/features/students/components/temp-password-panel";
import {
  resetStudentPassword,
  setCurrentModule,
  setStudentStatus,
  type ModuleOption,
  type StudentRow,
} from "@/features/students/data/students";

const NO_MODULE_VALUE = "none";

/**
 * Per-row admin actions: activate/deactivate, move to another module, or issue
 * a new temporary password.
 *
 * The dialogs are siblings of the menu rather than children of it — a dialog
 * rendered inside a DropdownMenuItem is unmounted the moment the menu closes.
 */
export function StudentRowActions({
  student,
  modules,
  onChanged,
}: {
  student: StudentRow;
  modules: ModuleOption[];
  /** Called after any change lands, so the roster can reload. */
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = React.useState(false);
  const [moduleValue, setModuleValue] = React.useState(
    student.moduleId ?? NO_MODULE_VALUE,
  );
  const [newPassword, setNewPassword] = React.useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = () =>
    run(() =>
      setStudentStatus(
        student.id,
        student.status === "active" ? "inactive" : "active",
      ),
    );

  const saveModule = () =>
    run(async () => {
      await setCurrentModule(
        student.id,
        moduleValue === NO_MODULE_VALUE ? null : moduleValue,
      );
      setModuleDialogOpen(false);
    });

  const resetPassword = async () => {
    setBusy(true);
    try {
      const { tempPassword } = await resetStudentPassword(student.id);
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
              <span className="sr-only">Actions for {student.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setModuleValue(student.moduleId ?? NO_MODULE_VALUE);
                setModuleDialogOpen(true);
              }}
            >
              Change module
            </DropdownMenuItem>
            {/* Disabled rather than alerting on click: a native dialog fired
                from `onSelect` races the menu's own close. */}
            <DropdownMenuItem
              disabled={!student.userId}
              onSelect={() => void resetPassword()}
            >
              <KeyRoundIcon />
              New temporary password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void toggleStatus()}>
              {student.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change module</DialogTitle>
            <DialogDescription>
              {student.name} will only see lessons from the module you pick. The
              one they’re leaving is marked completed in their history.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <Select value={moduleValue} onValueChange={setModuleValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MODULE_VALUE}>No module</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full"
              disabled={busy}
              onClick={() => void saveModule()}
            >
              {busy ? "Saving…" : "Save"}
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
              {student.name} can sign in with this until they set their own.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {newPassword && (
              <TempPasswordPanel email={student.email} password={newPassword} />
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
