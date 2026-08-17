import * as React from "react";

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
import { Label } from "@/components/ui/label";
import {
  CURRENCY,
  setStudentFinance,
  type FinanceRow,
} from "@/features/finance/data/finance";

/**
 * Sets what one student pays. Two fields and a save — anything more (a billing
 * date, a discount, a history of what they used to pay) is invoicing, which this
 * page deliberately isn't.
 *
 * An empty field means "not set" rather than zero, and clears the column back to
 * null. That distinction is the whole reason the summary can say how many
 * students nobody has priced up yet.
 */
export function EditFeeDialog({
  student,
  onSaved,
}: {
  student: FinanceRow;
  /** Called after a successful save, so the table can reload. */
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [fee, setFee] = React.useState("");
  const [classes, setClasses] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Seeded as the dialog opens rather than in an effect: the component is
  // mounted for the whole life of its row, so there is no mount to hang the
  // initial values off. (Same shape as StudentRowActions.)
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setFee(student.monthlyFee === null ? "" : String(student.monthlyFee));
    setClasses(
      student.classesPerWeek === null ? "" : String(student.classesPerWeek),
    );
    setError(null);
  };

  const save = async () => {
    const monthlyFee = fee.trim() === "" ? null : Number(fee);
    const classesPerWeek = classes.trim() === "" ? null : Number(classes);

    if (monthlyFee !== null && (!Number.isFinite(monthlyFee) || monthlyFee < 0)) {
      setError("Enter a fee of zero or more, or leave it blank.");
      return;
    }
    if (
      classesPerWeek !== null &&
      (!Number.isInteger(classesPerWeek) ||
        classesPerWeek < 0 ||
        classesPerWeek > 14)
    ) {
      setError("Enter a whole number of classes between 0 and 14.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await setStudentFinance(student.id, { monthlyFee, classesPerWeek });
      onSaved();
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
          <span className="sr-only"> what {student.name} pays</span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{student.name || "This student"}</DialogTitle>
          <DialogDescription>
            What they pay each month, and how many classes a week that covers.
            Leave a field blank to clear it.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-fee">Monthly fee ({CURRENCY})</Label>
            <Input
              id="monthly-fee"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Not set"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="classes-per-week">Classes per week</Label>
            <Input
              id="classes-per-week"
              type="number"
              inputMode="numeric"
              min={0}
              max={14}
              step={1}
              placeholder="Not set"
              value={classes}
              onChange={(event) => setClasses(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
