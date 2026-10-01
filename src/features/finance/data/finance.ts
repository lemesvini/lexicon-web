// What each student pays, what has actually come in, and how they pay.
//
// The price list lives on the student's roster row (see
// supabase/migrations/0007_groups_and_finances.sql): there is exactly one fee
// and one class count per student, and that also means the RLS is already right
// — the roster's own policy says an admin sees everyone and a teacher sees their
// own, so `listFinances()` returns a different list depending on who is asking,
// exactly as `listStudents()` does.
//
// Payments are a ledger of their own (0024, ./payments.ts): one row per payment
// received, each tagged with the month it pays for. `listFinances()` folds the
// current month's rows into `paidThisMonth`, which is what the table's status
// (Paid / Partial / Due / Overdue) is derived from. It is still not invoicing —
// nothing here generates a charge — but it does answer "who has paid?".
//
// The migration may not have been run yet. Both the billing columns and the
// payments table are therefore read softly: if they are missing the page falls
// back to the price list alone and says so, rather than failing to load.

import { supabase } from "@/lib/supabase";
import {
  currentMonthStart,
  isMissingRelation,
  type PaymentMethod,
} from "@/features/finance/data/payments";

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
  /** Day of the month the fee falls due, 1..31. Null until set. */
  billingDueDay: number | null;
  preferredMethod: PaymentMethod | null;
  billingNotes: string;
  /** Who pays when it isn't the student — usually a parent. */
  payerName: string;
  payerDocument: string;
  /** Sum of payments whose reference month is the current one. */
  paidThisMonth: number;
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
  // Only present once 0024 has run.
  billing_due_day?: number | null;
  preferred_payment_method?: string | null;
  billing_notes?: string | null;
  payer_name?: string | null;
  payer_document?: string | null;
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

const BASE_COLUMNS =
  "id, full_name, email, status, teacher_id, monthly_fee, classes_per_week";
const BILLING_COLUMNS =
  "billing_due_day, preferred_payment_method, billing_notes, payer_name, payer_document";
const TEACHER_EMBED = "teacher:profiles (full_name, email)";

/** What `listFinances()` returns: the rows, and which halves of the feature the
 *  database could serve. */
export type FinanceListing = {
  rows: FinanceRow[];
  /** False until 0024 has run: the billing columns are not there yet. */
  billingAvailable: boolean;
  /** False until 0024 has run: there is no payments table to sum. */
  paymentsAvailable: boolean;
};

function toMethod(value: string | null | undefined): PaymentMethod | null {
  return value === "pix" ||
    value === "credit_link" ||
    value === "boleto" ||
    value === "cheque"
    ? value
    : null;
}

/** Every student the caller can see, priced or not. Unpriced students are listed
 *  rather than filtered out — they are the ones worth finding.
 *
 *  Asks for the billing columns first and falls back to the original select if
 *  the database rejects them, so the page still loads before 0024 is run. */
export async function listFinances(): Promise<FinanceListing> {
  let billingAvailable = true;
  const select = (columns: string) =>
    supabase
      .from("students")
      .select(columns)
      .order("full_name", { ascending: true })
      .returns<FinanceRecord[]>();

  let result = await select(`${BASE_COLUMNS}, ${BILLING_COLUMNS}, ${TEACHER_EMBED}`);
  if (result.error) {
    billingAvailable = false;
    result = await select(`${BASE_COLUMNS}, ${TEACHER_EMBED}`);
  }
  if (result.error) throw new Error(result.error.message);

  // One query for the month's payments, summed here: it is a row per payment,
  // not per student, but a month of a school's payments is a short list.
  const paid = new Map<string, number>();
  let paymentsAvailable = true;
  const payments = await supabase
    .from("student_payments")
    .select("student_id, amount")
    .eq("reference_month", currentMonthStart());
  if (payments.error) {
    // A missing table is the expected "not migrated yet" case. Any other
    // failure is treated the same way: payments are an addition to the page,
    // and the price list under them is still worth showing.
    paymentsAvailable = false;
    if (!isMissingRelation(payments.error)) console.error(payments.error);
  } else {
    for (const payment of payments.data ?? []) {
      const amount = toNumber(payment.amount as number | string | null) ?? 0;
      paid.set(payment.student_id, (paid.get(payment.student_id) ?? 0) + amount);
    }
  }

  const rows = (result.data ?? []).map(
    (record) => {
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
        billingDueDay: record.billing_due_day ?? null,
        preferredMethod: toMethod(record.preferred_payment_method),
        billingNotes: record.billing_notes ?? "",
        payerName: record.payer_name ?? "",
        payerDocument: record.payer_document ?? "",
        paidThisMonth: paid.get(record.id) ?? 0,
      } satisfies FinanceRow;
    },
  );

  return { rows, billingAvailable, paymentsAvailable };
}

/** Where a student stands this month. */
export type PaymentStatus = "paid" | "partial" | "due" | "overdue" | "unpriced";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  due: "Due",
  overdue: "Overdue",
  unpriced: "Not priced",
};

/**
 * Paid / Partial / Due / Overdue, from the fee, what has come in this month and
 * the due day. Overdue means the due day has passed with something still owing
 * (a partial payment past the day is overdue too — it is the more urgent word).
 * A due day past the end of a short month counts as the month's last day.
 */
export function paymentStatus(
  row: FinanceRow,
  today: Date = new Date(),
): PaymentStatus {
  if (row.monthlyFee === null) return "unpriced";
  if (row.paidThisMonth >= row.monthlyFee) return "paid";

  if (row.billingDueDay !== null) {
    const lastDay = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    if (today.getDate() > Math.min(row.billingDueDay, lastDay)) return "overdue";
  }
  return row.paidThisMonth > 0 ? "partial" : "due";
}

/** What is still owed for this month, never below zero. */
export function amountOutstanding(row: FinanceRow): number {
  return row.monthlyFee === null
    ? 0
    : Math.max(row.monthlyFee - row.paidThisMonth, 0);
}

/** What the billing dialog saves. Blank text is stored as null, like the fee. */
export type BillingInput = {
  monthlyFee: number | null;
  classesPerWeek: number | null;
  billingDueDay: number | null;
  preferredMethod: PaymentMethod | null;
  billingNotes: string | null;
  payerName: string | null;
  payerDocument: string | null;
};

/** Sets (or clears, with null) what a student pays, how often they come, and
 *  the billing details around it. `billing` is false before 0024 has run, in
 *  which case only the two original columns are written. */
export async function setStudentBilling(
  studentId: string,
  input: BillingInput,
  billing = true,
): Promise<void> {
  const base = {
    monthly_fee: input.monthlyFee,
    classes_per_week: input.classesPerWeek,
  };
  const { error } = await supabase
    .from("students")
    .update(
      billing
        ? {
            ...base,
            billing_due_day: input.billingDueDay,
            preferred_payment_method: input.preferredMethod,
            billing_notes: input.billingNotes,
            payer_name: input.payerName,
            payer_document: input.payerDocument,
          }
        : base,
    )
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
  /** Everything recorded against this month, whoever it came from. */
  receivedThisMonth: number;
  /** What active, priced students still owe for this month. */
  outstanding: number;
};

/**
 * The strip above the table. Inactive students are left out of the billed
 * figures — they aren't billed, so counting them would overstate the month.
 * What was received is counted for everyone: money that arrived is money that
 * arrived.
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
    receivedThisMonth: rows.reduce((total, row) => total + row.paidThisMonth, 0),
    outstanding: priced.reduce((total, row) => total + amountOutstanding(row), 0),
  };
}
