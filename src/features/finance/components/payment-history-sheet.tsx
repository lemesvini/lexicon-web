import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatMoney,
  type FinanceRow,
} from "@/features/finance/data/finance";
import {
  deletePayment,
  formatDay,
  formatMonth,
  listStudentPayments,
  methodLabel,
  type PaymentRow,
} from "@/features/finance/data/payments";

/**
 * One student's payments, newest first, in a right-hand drawer — the same shape
 * as the "About group" drawer on the group page. Each entry can be deleted (a
 * payment entered against the wrong student or month is fixed by removing it and
 * recording it again), and "Record payment" hands over to the page's dialog.
 *
 * `student` null keeps it closed. The list is its own component so it mounts —
 * and loads — each time the drawer opens, for whichever student it opens on.
 */
export function PaymentHistorySheet({
  student,
  onOpenChange,
  onRecord,
  onChanged,
}: {
  student: FinanceRow | null;
  onOpenChange: (open: boolean) => void;
  /** Asks the page to open the record-payment dialog for this student. */
  onRecord: (student: FinanceRow) => void;
  /** Called after a payment is deleted, so the table's totals reload. */
  onChanged: () => void;
}) {
  return (
    <Sheet open={student !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg">
        <SheetHeader>
          <SheetTitle>Payments — {student?.name ?? ""}</SheetTitle>
          <SheetDescription>
            Everything recorded for this student, newest first.
          </SheetDescription>
        </SheetHeader>

        {student && (
          <PaymentList
            key={student.id}
            student={student}
            onRecord={onRecord}
            onChanged={onChanged}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentList({
  student,
  onRecord,
  onChanged,
}: {
  student: FinanceRow;
  onRecord: (student: FinanceRow) => void;
  onChanged: () => void;
}) {
  const [payments, setPayments] = React.useState<PaymentRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listStudentPayments(student.id)
      .then((next) => {
        if (!cancelled) setPayments(next);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id, reloadKey]);

  const remove = async (payment: PaymentRow) => {
    if (
      !window.confirm(
        `Delete the ${formatMoney(payment.amount)} payment for ${formatMonth(payment.referenceMonth)}?`,
      )
    ) {
      return;
    }
    setBusyId(payment.id);
    setError(null);
    try {
      await deletePayment(payment.id);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="no-scrollbar -mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
      <Button size="sm" onClick={() => onRecord(student)}>
        <PlusIcon />
        Record payment
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {payments === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payments?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No payments recorded yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {payments?.map((payment) => (
            <li
              key={payment.id}
              className="flex items-start justify-between gap-3 p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium tabular-nums">
                  {formatMoney(payment.amount)}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {methodLabel(payment.method)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  For {formatMonth(payment.referenceMonth)} · paid{" "}
                  {formatDay(payment.paidOn)}
                </p>
                {payment.notes && (
                  <p className="text-xs text-muted-foreground">
                    {payment.notes}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === payment.id}
                onClick={() => void remove(payment)}
              >
                <Trash2Icon />
                <span className="sr-only">Delete this payment</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
