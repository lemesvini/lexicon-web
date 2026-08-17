import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { financesColumns } from "@/features/finance/components/finances-columns";
import {
  formatMoney,
  listFinances,
  summarize,
  type FinanceRow,
} from "@/features/finance/data/finance";

/**
 * The price list: every student the signed-in user can see, what they pay a
 * month, and how many classes a week that buys — with the month's total above
 * it.
 *
 * Who appears is decided in the database, not here: the roster's RLS gives a
 * teacher their own students and the admin everyone (see 0006), so a teacher's
 * total is their own book and the admin's is the school's.
 *
 * Inactive students stay in the list and out of the totals. They aren't billed,
 * so counting them would overstate the month — but hiding them would make a
 * student who was deactivated by mistake impossible to find.
 */
export function FinancesTable() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [rows, setRows] = React.useState<FinanceRow[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    listFinances()
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const refresh = () => {
    setStatus("loading");
    reload();
  };

  const columns = React.useMemo(
    () => financesColumns({ isAdmin, onChanged: reload }),
    [isAdmin, reload],
  );

  const summary = React.useMemo(() => summarize(rows), [rows]);

  // Built from the rows rather than from a teacher list, for the same reason as
  // the roster's: a deactivated teacher still has students here, and a facet
  // that couldn't select them would leave those rows unreachable.
  const teacherOptions = React.useMemo(
    () => [...new Set(rows.map((row) => row.teacher))].sort(),
    [rows],
  );

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
      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Monthly" value={formatMoney(summary.monthlyRevenue)} />
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
        data={rows}
        filterColumn="name"
        filterPlaceholder="Filter students..."
        facets={[
          ...(isAdmin
            ? [
                {
                  columnId: "teacher",
                  label: "Teacher",
                  options: teacherOptions,
                  clearLabel: "All teachers",
                },
              ]
            : []),
          {
            columnId: "status",
            label: "Status",
            options: ["Active", "Inactive"],
            clearLabel: "All statuses",
          },
        ]}
        emptyMessage="No students match."
        countLabel={(count) => `${count} student${count === 1 ? "" : "s"}`}
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
