import * as React from "react";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { FacetedFilter } from "@/components/data-table-faceted-filter";
import { TableSkeleton } from "@/components/table-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BillingDialog } from "@/features/finance/components/billing-dialog";
import { financesColumns } from "@/features/finance/components/finances-columns";
import { PaymentHistorySheet } from "@/features/finance/components/payment-history-sheet";
import { RecordPaymentDialog } from "@/features/finance/components/record-payment-dialog";
import {
  formatMoney,
  PAYMENT_STATUS_LABEL,
  listFinances,
  summarize,
  type FinanceRow,
} from "@/features/finance/data/finance";

/**
 * The finances page body: every student the signed-in user can see, what they
 * pay a month, whether they have paid this month — with the month's figures
 * above it, and the dialogs to record a payment, read a student's payment
 * history and edit their billing details.
 *
 * The dialogs live here, once each, rather than in every row: the row menu, the
 * history drawer and the header button all open the same ones.
 *
 * Who appears is decided in the database, not here: the roster's RLS gives a
 * teacher their own students and the admin everyone (see 0006), so a teacher's
 * total is their own book, and one teacher cannot read another's fees however
 * this page is driven.
 *
 * The admin sees everyone, but opens on themselves: the teacher filter starts on
 * the signed-in user and the summary strip is computed from what it leaves, so
 * the month's total is the total for the teacher being looked at rather than the
 * school's. Clearing the filter puts the school back.
 *
 * Inactive students stay in the list and out of the totals. They aren't billed,
 * so counting them would overstate the month — but hiding them would make a
 * student who was deactivated by mistake impossible to find.
 */
export function FinancesTable({
  heading,
}: {
  /** The page title block. Rendered here, beside the "Record payment" button,
   *  because that button needs the rows this component loads. */
  heading?: React.ReactNode;
}) {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const isAdmin = profile?.role === "admin";

  const [rows, setRows] = React.useState<FinanceRow[]>([]);
  // Teacher names, empty for "everyone". Held here rather than in the table's
  // own toolbar because the figures above the table have to move with it, and a
  // column filter is only known to the column.
  const [teacherFilter, setTeacherFilter] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  // False until migration 0024 has run; the page then shows the price list only.
  const [billingAvailable, setBillingAvailable] = React.useState(true);
  const [paymentsAvailable, setPaymentsAvailable] = React.useState(true);

  // The three dialogs. Each holds the student it is open for, or null.
  const [paying, setPaying] = React.useState<{ studentId: string | null } | null>(
    null,
  );
  const [historyId, setHistoryId] = React.useState<string | null>(null);
  const [billingId, setBillingId] = React.useState<string | null>(null);

  // Only the first load seeds the filter; a reload after a fee is edited must
  // leave whatever the user has since chosen alone.
  const seeded = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    listFinances()
      .then((listing) => {
        if (cancelled) return;
        const next = listing.rows;
        setBillingAvailable(listing.billingAvailable);
        setPaymentsAvailable(listing.paymentsAvailable);
        if (!seeded.current) {
          seeded.current = true;
          // Matched on the id rather than on `profile.fullName`: the column
          // falls back to the teacher's email when they have no name, and a
          // filter naming nobody would show an empty book and a zero total.
          const own = next.find((row) => row.teacherId === profileId)?.teacher;
          if (own) setTeacherFilter([own]);
        }
        setRows(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, profileId]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const refresh = () => {
    setStatus("loading");
    reload();
  };

  const columns = React.useMemo(
    () =>
      financesColumns({
        isAdmin,
        handlers: {
          onRecordPayment: (student) => setPaying({ studentId: student.id }),
          onShowHistory: (student) => setHistoryId(student.id),
          onEditBilling: (student) => setBillingId(student.id),
        },
      }),
    [isAdmin],
  );

  // Everything below this line — the figures, the table, the count under it —
  // is about one teacher's students at a time.
  const visible = React.useMemo(
    () =>
      teacherFilter.length === 0
        ? rows
        : rows.filter((row) => teacherFilter.includes(row.teacher)),
    [rows, teacherFilter],
  );

  // From the teacher's rows, not the table's filtered ones: the search box and
  // the status facet are ways of finding a student, and a monthly total that
  // dropped every time someone typed a name would be a number nobody could
  // trust. Inactive students are already out of it — see `summarize`.
  const summary = React.useMemo(() => summarize(visible), [visible]);

  // Built from the rows rather than from a teacher list, for the same reason as
  // the roster's: a deactivated teacher still has students here, and a facet
  // that couldn't select them would leave those rows unreachable.
  const teacherOptions = React.useMemo(
    () => [...new Set(rows.map((row) => row.teacher))].sort(),
    [rows],
  );

  // Looked up by id rather than held as rows, so a reload after a save puts the
  // fresh figures in front of the open drawer instead of a stale copy.
  const historyStudent = rows.find((row) => row.id === historyId) ?? null;
  const billingStudent = rows.find((row) => row.id === billingId) ?? null;

  if (status === "loading") return <TableSkeleton />;

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">Couldn’t load the fees.</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {heading}
        <Button onClick={() => setPaying({ studentId: null })}>
          <PlusIcon />
          Record payment
        </Button>
      </div>

      {(!paymentsAvailable || !billingAvailable) && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Payments and billing details aren’t set up in the database yet — run
          migration 0024_payments.sql. Until then this page shows the price list
          only.
        </p>
      )}

      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {/* Named, because the same figure is now one teacher's book or the
            whole school's depending on a dropdown, and a total that big should
            never leave you guessing which one you're reading. */}
        <Figure
          label="Monthly"
          value={formatMoney(summary.monthlyRevenue)}
          hint={
            isAdmin
              ? teacherFilter.length === 1
                ? teacherFilter[0]
                : teacherFilter.length > 1
                  ? `${teacherFilter.length} teachers`
                  : "Across the school"
              : undefined
          }
        />
        <Figure
          label="Received this month"
          value={formatMoney(summary.receivedThisMonth)}
        />
        <Figure
          label="Outstanding"
          value={formatMoney(summary.outstanding)}
          hint="Still owed for this month"
        />
        <Figure
          label="Paying students"
          value={String(summary.payingCount)}
          hint={
            summary.unpricedCount > 0
              ? `${summary.unpricedCount} without a fee`
              : undefined
          }
        />
        <Figure label="Average fee" value={formatMoney(summary.averageFee)} />
        <Figure
          label="Classes a week"
          value={String(summary.weeklyClasses)}
          hint="Across active students"
        />
      </div>

      <DataTable
        columns={columns}
        data={visible}
        filterColumn="name"
        filterPlaceholder="Filter students..."
        // The teacher picker is the caller's, not a column facet: the summary
        // strip is filtered by it too, and only this component can see both.
        toolbarActions={
          isAdmin ? (
            <FacetedFilter
              label="Teacher"
              options={teacherOptions}
              clearLabel="All teachers"
              value={teacherFilter}
              onValueChange={setTeacherFilter}
            />
          ) : undefined
        }
        facets={[
          {
            columnId: "paymentStatus",
            label: "Payment",
            options: Object.values(PAYMENT_STATUS_LABEL),
            clearLabel: "All payments",
          },
          {
            columnId: "status",
            label: "Status",
            options: ["Active", "Inactive"],
            clearLabel: "All statuses",
          },
        ]}
        emptyMessage={
          rows.length && !visible.length
            ? "No students for that teacher."
            : "No students match."
        }
        countLabel={(count) => `${count} student${count === 1 ? "" : "s"}`}
      />

      <RecordPaymentDialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        // Inactive students aren't billed, so they aren't offered — unless the
        // dialog was opened on one from its own row.
        students={visible.filter(
          (row) => row.status === "active" || row.id === paying?.studentId,
        )}
        studentId={paying?.studentId ?? null}
        paymentsAvailable={paymentsAvailable}
        onSaved={reload}
      />
      <PaymentHistorySheet
        student={historyStudent}
        onOpenChange={(open) => {
          if (!open) setHistoryId(null);
        }}
        onRecord={(student) => setPaying({ studentId: student.id })}
        onChanged={reload}
      />
      <BillingDialog
        student={billingStudent}
        onOpenChange={(open) => {
          if (!open) setBillingId(null);
        }}
        billingAvailable={billingAvailable}
        onSaved={reload}
      />
    </div>
  );
}

/** One cell of the summary strip. The `gap-px` on a bordered grid above is what
 *  draws the hairlines between them, so each of these is plain padding. */
function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1 bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
