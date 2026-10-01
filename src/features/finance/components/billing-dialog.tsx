import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCY,
  setStudentBilling,
  type FinanceRow,
} from "@/features/finance/data/finance";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/features/finance/data/payments";

/** Radix Select can't hold an empty string as a value, so "no preference" is
 *  this sentinel on the way in and out. */
const NONE = "none";

/**
 * Everything the school knows about how one student is billed: the fee and how
 * many classes it buys, the day it falls due, the method they usually pay by,
 * and — when a parent pays — who that is.
 *
 * An empty field means "not set" rather than zero, and clears the column back to
 * null. That distinction is the whole reason the summary can say how many
 * students nobody has priced up yet.
 *
 * Controlled by the page, not self-triggered: the same dialog is opened from the
 * row menu and from the payment drawer. The form is its own component so it
 * mounts — and seeds its fields from the student — each time the dialog opens.
 */
export function BillingDialog({
  student,
  onOpenChange,
  billingAvailable,
  onSaved,
}: {
  /** The student being edited; null keeps the dialog closed. */
  student: FinanceRow | null;
  onOpenChange: (open: boolean) => void;
  /** False until migration 0024 has run — the extra fields are then disabled. */
  billingAvailable: boolean;
  /** Called after a successful save, so the table can reload. */
  onSaved: () => void;
}) {
  return (
    <Dialog open={student !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {student && (
          <BillingForm
            student={student}
            billingAvailable={billingAvailable}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BillingForm({
  student,
  billingAvailable,
  onClose,
  onSaved,
}: {
  student: FinanceRow;
  billingAvailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fee, setFee] = React.useState(
    student.monthlyFee === null ? "" : String(student.monthlyFee),
  );
  const [classes, setClasses] = React.useState(
    student.classesPerWeek === null ? "" : String(student.classesPerWeek),
  );
  const [dueDay, setDueDay] = React.useState(
    student.billingDueDay === null ? "" : String(student.billingDueDay),
  );
  const [method, setMethod] = React.useState<string>(
    student.preferredMethod ?? NONE,
  );
  const [notes, setNotes] = React.useState(student.billingNotes);
  const [payerName, setPayerName] = React.useState(student.payerName);
  const [payerDocument, setPayerDocument] = React.useState(
    student.payerDocument,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    const monthlyFee = fee.trim() === "" ? null : Number(fee);
    const classesPerWeek = classes.trim() === "" ? null : Number(classes);
    const billingDueDay = dueDay.trim() === "" ? null : Number(dueDay);

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
    if (
      billingDueDay !== null &&
      (!Number.isInteger(billingDueDay) ||
        billingDueDay < 1 ||
        billingDueDay > 31)
    ) {
      setError("Enter a due day between 1 and 31, or leave it blank.");
      return;
    }

    const text = (value: string) => (value.trim() === "" ? null : value.trim());

    setBusy(true);
    setError(null);
    try {
      await setStudentBilling(
        student.id,
        {
          monthlyFee,
          classesPerWeek,
          billingDueDay,
          preferredMethod: method === NONE ? null : (method as PaymentMethod),
          billingNotes: text(notes),
          payerName: text(payerName),
          payerDocument: text(payerDocument),
        },
        billingAvailable,
      );
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Billing details</DialogTitle>
        <DialogDescription>
          {student.name || "This student"} — what they pay, when it is due and
          how. Leave a field blank to clear it.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        {!billingAvailable && (
          <p className="text-sm text-muted-foreground">
            Due day, payment method and payer need migration 0024 to be run
            first.
          </p>
        )}

        <fieldset
          disabled={!billingAvailable}
          className="space-y-4 disabled:opacity-50"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="due-day">Due day of the month</Label>
              <Input
                id="due-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                step={1}
                placeholder="Not set"
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred-method">Usually pays by</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="preferred-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No preference</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payer-name">Payer name</Label>
              <Input
                id="payer-name"
                placeholder="If not the student"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payer-document">Payer CPF / CNPJ</Label>
              <Input
                id="payer-document"
                placeholder="Optional"
                value={payerDocument}
                onChange={(event) => setPayerDocument(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-notes">Notes</Label>
            <Input
              id="billing-notes"
              placeholder="e.g. pays the first week of the month"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}
