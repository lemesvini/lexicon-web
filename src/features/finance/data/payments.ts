// The payment ledger: one row per payment received (supabase/migrations/
// 0024_payments.sql).
//
// RLS is the roster's — an admin sees every payment, a teacher those of their
// own students — so nothing here filters by teacher.

import { supabase } from "@/lib/supabase";

export type PaymentMethod = "pix" | "credit_link" | "boleto" | "cheque";

/** In the order they are offered. Labels are the school's own names for them. */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "credit_link", label: "Credit card link" },
  { value: "boleto", label: "Boleto" },
  { value: "cheque", label: "Cheque" },
];

export function methodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export type PaymentRow = {
  id: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  /** ISO date (YYYY-MM-DD) the money arrived. */
  paidOn: string;
  /** ISO date, always the first of the month the payment is for. */
  referenceMonth: string;
  notes: string;
  createdAt: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The first day of the current month, as the date the table stores. Built from
 *  local parts: `toISOString()` is UTC and would name tomorrow's month on the
 *  last evening of a month in Brazil. */
export function currentMonthStart(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

/** Today as YYYY-MM-DD in local time, for `<input type="date">`. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-10" (an `<input type="month">` value) to "2026-10-01". */
export function monthInputToDate(value: string): string {
  return `${value}-01`;
}

/** "2026-10-01" to "2026-10". */
export function dateToMonthInput(date: string): string {
  return date.slice(0, 7);
}

const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

/** "October 2026". Parsed from the parts, not `new Date(iso)`, which is UTC and
 *  would slip a month back west of Greenwich. */
export function formatMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return monthFormat.format(new Date(y, (m || 1) - 1, 1));
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return dayFormat.format(new Date(y, (m || 1) - 1, d || 1));
}

/** True for the error PostgREST/Postgres gives when the table isn't there —
 *  i.e. 0024 hasn't been run. */
export function isMissingRelation(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

type PaymentRecord = {
  id: string;
  student_id: string;
  amount: number | string;
  method: PaymentMethod;
  paid_on: string;
  reference_month: string;
  notes: string | null;
  created_at: string;
};

function toRow(record: PaymentRecord): PaymentRow {
  return {
    id: record.id,
    studentId: record.student_id,
    amount: Number(record.amount),
    method: record.method,
    paidOn: record.paid_on,
    referenceMonth: record.reference_month,
    notes: record.notes ?? "",
    createdAt: record.created_at,
  };
}

const COLUMNS =
  "id, student_id, amount, method, paid_on, reference_month, notes, created_at";

/** One student's payments, newest first. Soft: a missing table reads as no
 *  payments, so the history drawer opens empty rather than erroring. */
export async function listStudentPayments(
  studentId: string,
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("student_payments")
    .select(COLUMNS)
    .eq("student_id", studentId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as PaymentRecord[]).map(toRow);
}

/** Every payment that pays for one month (`month` is its first day). */
export async function listMonthPayments(month: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("student_payments")
    .select(COLUMNS)
    .eq("reference_month", month)
    .order("paid_on", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as PaymentRecord[]).map(toRow);
}

export type NewPayment = {
  studentId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  referenceMonth: string;
  notes: string | null;
};

/** Records a payment. `recorded_by` is filled by the column default. */
export async function createPayment(input: NewPayment): Promise<void> {
  const { error } = await supabase.from("student_payments").insert({
    student_id: input.studentId,
    amount: input.amount,
    method: input.method,
    paid_on: input.paidOn,
    reference_month: input.referenceMonth,
    notes: input.notes,
  });

  if (error) {
    throw new Error(
      isMissingRelation(error)
        ? "Payments aren’t set up yet — run migration 0024_payments.sql first."
        : error.message,
    );
  }
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase
    .from("student_payments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
