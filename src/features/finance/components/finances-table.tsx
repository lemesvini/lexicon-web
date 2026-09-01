import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { FacetedFilter } from "@/components/data-table-faceted-filter";
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
export function FinancesTable() {
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

  // Only the first load seeds the filter; a reload after a fee is edited must
  // leave whatever the user has since chosen alone.
  const seeded = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    listFinances()
      .then((next) => {
        if (cancelled) return;
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
    () => financesColumns({ isAdmin, onChanged: reload }),
    [isAdmin, reload],
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
