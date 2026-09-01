// What each student pays, and what it buys them.
//
// There is no finance table: the two numbers live on the student's roster row
// (see supabase/migrations/0007_groups_and_finances.sql), because there is
// exactly one of each per student. That also means the RLS is already right —
// the roster's own policy says an admin sees everyone and a teacher sees their
// own, so `listFinances()` returns a different list depending on who is asking,
// exactly as `listStudents()` does.
//
// This is a price list, not a ledger. Nothing here records a payment; the
// question the page answers is "what should be coming in each month", which is
// the one a school actually needs before it needs invoicing.

import { supabase } from "@/lib/supabase";

/**
 * The currency the school bills in, as an ISO 4217 code. One line to change if
 * that isn't yours — the locale is deliberately left to the browser (as it is
 * for dates elsewhere), so only the code itself is a decision.
 */
export const CURRENCY = "BRL";

// Both digit options are set: given only a maximum below the currency's own
// precision, the engine is left to reconcile it against a default minimum of 2,
// which it is only obliged to clamp rather than honour.
const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** A fee as a column reads it. Whole units — the cents are noise in a figure you
 *  scan down a page, and nothing here is an invoice. */
export function formatMoney(amount: number): string {
  return money.format(amount);
}

export type FinanceStatus = "active" | "inactive";

/** One row of the finances table, flattened for @/components/data-table. */
export type FinanceRow = {
  id: string;
  name: string;
  email: string;
  status: FinanceStatus;
  teacherId: string | null;
  /** Teacher name, or "—". Only shown to the admin, as on the roster. */
  teacher: string;
  /** Null until someone has priced this student up — not zero. */
  monthlyFee: number | null;
  classesPerWeek: number | null;
};

const NO_TEACHER = "—";

type Embedded<T> = T | T[] | null;

/** PostgREST returns an embedded to-one either as an object or as a
 *  one-element array, depending on how it resolves the relationship. */
function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type FinanceRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  teacher_id: string | null;
  monthly_fee: number | string | null;
  classes_per_week: number | null;
  teacher: Embedded<{ full_name?: string | null; email?: string | null }>;
};

/**
 * `numeric` comes back from PostgREST as a string, because a JSON number can't
 * hold every value the column can. Parsed here rather than at the call site so
 * nothing downstream has to remember that.
 */
function toNumber(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Every student the caller can see, priced or not. Unpriced students are listed
 *  rather than filtered out — they are the ones worth finding. */
export async function listFinances(): Promise<FinanceRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, full_name, email, status, teacher_id, monthly_fee, classes_per_week, teacher:profiles (full_name, email)",
    )
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as FinanceRecord[]).map((record) => {
    const teacher = one(record.teacher);
    return {
      id: record.id,
      name: record.full_name ?? "",
      email: record.email ?? "",
      status: record.status === "inactive" ? "inactive" : "active",
      teacherId: record.teacher_id,
      teacher: teacher?.full_name || teacher?.email || NO_TEACHER,
      monthlyFee: toNumber(record.monthly_fee),
      classesPerWeek: record.classes_per_week,
    };
  });
}

/** Sets (or clears, with null) what a student pays and how often they come. */
export async function setStudentFinance(
  studentId: string,
  input: { monthlyFee: number | null; classesPerWeek: number | null },
): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({
      monthly_fee: input.monthlyFee,
      classes_per_week: input.classesPerWeek,
    })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
}

export type FinanceSummary = {
  /** Sum of what active, priced students pay each month. */
  monthlyRevenue: number;
  /** How many of them there are — the divisor behind `averageFee`. */
  payingCount: number;
  averageFee: number;
  /** Classes a week the school has committed to teaching, active students only. */
  weeklyClasses: number;
  /** Active students with no fee set. Worth surfacing: each one is revenue the
   *  total above is silently missing. */
  unpricedCount: number;
};

/**
 * The strip above the table. Inactive students are left out of every figure —
 * they aren't billed, so counting them would overstate the month.
 */
export function summarize(rows: FinanceRow[]): FinanceSummary {
  const active = rows.filter((row) => row.status === "active");
  const priced = active.filter((row) => row.monthlyFee !== null);

  const monthlyRevenue = priced.reduce(
    (total, row) => total + (row.monthlyFee ?? 0),
    0,
  );
  const weeklyClasses = active.reduce(
    (total, row) => total + (row.classesPerWeek ?? 0),
    0,
  );

  return {
    monthlyRevenue,
    payingCount: priced.length,
    averageFee: priced.length ? monthlyRevenue / priced.length : 0,
    weeklyClasses,
    unpricedCount: active.length - priced.length,
  };
}
