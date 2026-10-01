import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PaymentMethodPicker } from "@/features/finance/components/payment-method-picker";
import {
  amountOutstanding,
  CURRENCY,
  type FinanceRow,
} from "@/features/finance/data/finance";
import {
  createPayment,
  currentMonthStart,
  dateToMonthInput,
  monthInputToDate,
  todayIso,
  type PaymentMethod,
} from "@/features/finance/data/payments";
import { cn } from "@/lib/utils";

/**
 * Records one payment. Opened from a row (the student is preset) or from the
 * page header (a searchable list of the students on the page).
 *
 * The amount starts at what the student still owes for the current month and the
 * method at the one they usually use, so the common case — "they paid what they
 * owe, the way they always do" — is two clicks. Both are only defaults: picking a
 * different student re-seeds them, typing over them is respected.
 *
 * `open` is held by the page; the form is its own component so it mounts, and
 * seeds itself, each time the dialog opens.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  students,
  studentId,
  paymentsAvailable,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who can be picked. */
  students: FinanceRow[];
  /** The student to preset, or null to choose one. */
  studentId: string | null;
  /** False until migration 0024 has run — saving is then disabled. */
  paymentsAvailable: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <PaymentForm
            students={students}
            initialStudentId={studentId}
            paymentsAvailable={paymentsAvailable}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The amount and method a student's payment starts from. */
function defaultsFor(student: FinanceRow | undefined): {
  amount: string;
  method: PaymentMethod;
} {
  const owed = student ? amountOutstanding(student) : 0;
  return {
    amount: owed > 0 ? String(owed) : "",
    method: student?.preferredMethod ?? "pix",
  };
}

function PaymentForm({
  students,
  initialStudentId,
  paymentsAvailable,
  onClose,
  onSaved,
}: {
  students: FinanceRow[];
  initialStudentId: string | null;
  paymentsAvailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = defaultsFor(students.find((s) => s.id === initialStudentId));

  const [selectedId, setSelectedId] = React.useState(initialStudentId);
  const [amount, setAmount] = React.useState(initial.amount);
  const [method, setMethod] = React.useState<PaymentMethod>(initial.method);
  const [paidOn, setPaidOn] = React.useState(todayIso());
  const [month, setMonth] = React.useState(
    dateToMonthInput(currentMonthStart()),
  );
  const [notes, setNotes] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const student = students.find((s) => s.id === selectedId);

  const chooseStudent = (next: FinanceRow) => {
    setSelectedId(next.id);
    const defaults = defaultsFor(next);
    setAmount(defaults.amount);
    setMethod(defaults.method);
    setPickerOpen(false);
  };

  const save = async () => {
    const value = Number(amount);
    if (!student) {
      setError("Choose a student.");
      return;
    }
    if (amount.trim() === "" || !Number.isFinite(value) || value < 0) {
      setError("Enter the amount received, zero or more.");
      return;
    }
    if (!paidOn || !month) {
      setError("Enter the date paid and the month it pays for.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createPayment({
        studentId: student.id,
        amount: value,
        method,
        paidOn,
        referenceMonth: monthInputToDate(month),
        notes: notes.trim() === "" ? null : notes.trim(),
      });
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
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          Money received from a student, and the month it pays for.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {!paymentsAvailable && (
          <p className="text-sm text-destructive">
            Payments aren’t set up yet — run migration 0024_payments.sql first.
          </p>
        )}

        <div className="space-y-2">
          <Label>Student</Label>
          {initialStudentId !== null && student ? (
            // Opened from a row: the student is the whole point, not a choice.
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {student.name}
            </p>
          ) : (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
                  {student ? student.name : "Choose a student…"}
                  <ChevronsUpDownIcon className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
              >
                <Command>
                  <CommandInput placeholder="Search students..." />
                  <CommandList>
                    <CommandEmpty>No student found.</CommandEmpty>
                    <CommandGroup>
                      {students.map((s) => (
                        <CommandItem
                          key={s.id}
                          // cmdk filters on this string, so the email makes two
                          // students with the same name findable apart.
                          value={`${s.name} ${s.email} ${s.id}`}
                          onSelect={() => chooseStudent(s)}
                        >
                          <CheckIcon
                            className={cn(
                              s.id === selectedId ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{s.name || s.email}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-amount">Amount ({CURRENCY})</Label>
          <Input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Method</Label>
          <PaymentMethodPicker value={method} onChange={setMethod} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-date">Paid on</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-month">For the month of</Label>
            <Input
              id="payment-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-notes">Notes</Label>
          <Input
            id="payment-notes"
            placeholder="Optional"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          disabled={busy || !paymentsAvailable}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </>
  );
}
