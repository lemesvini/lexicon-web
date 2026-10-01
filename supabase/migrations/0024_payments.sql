-- Payments: what each student has actually paid, and how they like to pay.
--
-- 0007 gave the finances page a price list — `monthly_fee` and
-- `classes_per_week` on `students`. This adds the other half, the ledger of what
-- came in, plus a little more billing detail on the student's own row:
--
--   student_payments  one row per payment received: how much, by which method,
--                     on what day, and for which month it pays. A student can
--                     pay a month in two instalments, or two months at once, so
--                     this is a table of its own rather than a flag on the
--                     student — "paid this month" is a sum over these rows.
--
--   students          four nullable columns of billing detail: the day of the
--                     month the fee is due, the method they usually pay by, a
--                     free-text note, and who actually pays (a parent, usually).
--
-- RLS mirrors the roster (0006/0007) exactly: `is_admin()` sees and edits
-- everything, and an active teacher sees and edits the payments of the students
-- they own, via `owns_student()`. Whoever can edit a student's fee can record
-- what that student paid, and nobody else can. Students get no access: a payment
-- ledger is a staff record, and there is no student-facing UI for it.
--
-- `students` has no column-level grants or views in front of it (the only
-- revokes in earlier migrations are on the student_* views and functions), so
-- the new columns need no grant changes.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) after 0023.
-- Idempotent — safe to re-run. No Edge Function changes: nothing here touches an
-- auth account.

-- Billing details on the student ----------------------------------------------
-- All nullable, and null means "not set yet" — same convention as the fee.

-- The day of the month the fee falls due. 1..31 rather than 1..28: the page
-- treats a day past the end of a short month as the last day of it.
alter table public.students
  add column if not exists billing_due_day smallint
    check (billing_due_day is null or billing_due_day between 1 and 31);

alter table public.students
  add column if not exists preferred_payment_method text
    check (
      preferred_payment_method is null
      or preferred_payment_method in ('pix', 'credit_link', 'boleto', 'cheque')
    );

alter table public.students
  add column if not exists billing_notes text;

-- Who pays, when it isn't the student: a parent's name, and their CPF/CNPJ for
-- the boleto or receipt. Free text — no validation, because this is a note to
-- the person recording the payment, not an input to anything.
alter table public.students
  add column if not exists payer_name text;

alter table public.students
  add column if not exists payer_document text;

-- Payments ---------------------------------------------------------------------

create table if not exists public.student_payments (
  id               uuid primary key default gen_random_uuid(),
  -- Cascades: a payment means nothing once the student it belongs to is gone.
  student_id       uuid not null references public.students (id) on delete cascade,
  -- numeric, not float, for the reason given in 0007.
  amount           numeric(10, 2) not null check (amount >= 0),
  method           text not null
    check (method in ('pix', 'credit_link', 'boleto', 'cheque')),
  -- The day the money arrived.
  paid_on          date not null default current_date,
  -- The month it pays for, as the first day of that month. Kept apart from
  -- `paid_on` because they differ all the time: January's fee paid on 3 February.
  reference_month  date not null
    check (extract(day from reference_month) = 1),
  notes            text,
  recorded_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);

create index if not exists student_payments_student_month_idx
  on public.student_payments (student_id, reference_month);

-- Row Level Security -----------------------------------------------------------

alter table public.student_payments enable row level security;

-- Same predicate for all four commands, spelled out per command so each can be
-- tightened on its own later. `owns_student()` (0006) is already
-- "admin, or the active teacher this student belongs to".
drop policy if exists "student_payments_select_own" on public.student_payments;
create policy "student_payments_select_own"
  on public.student_payments
  for select
  to authenticated
  using (public.owns_student(student_id));

drop policy if exists "student_payments_insert_own" on public.student_payments;
create policy "student_payments_insert_own"
  on public.student_payments
  for insert
  to authenticated
  with check (public.owns_student(student_id));

drop policy if exists "student_payments_update_own" on public.student_payments;
create policy "student_payments_update_own"
  on public.student_payments
  for update
  to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

drop policy if exists "student_payments_delete_own" on public.student_payments;
create policy "student_payments_delete_own"
  on public.student_payments
  for delete
  to authenticated
  using (public.owns_student(student_id));
