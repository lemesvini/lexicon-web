-- Student onboarding: the questions a student answers on their first visit.
--
-- Two pieces: a timestamp that says whether they've answered, and one function
-- that lets them write their answers into their own row.
--
-- The answers are not stored as their own structure. They become a block of
-- question/answer text appended to `students.notes` — the field the admin
-- dashboard already shows as "Student's Context" (see
-- src/features/students/components/student-notes-card.tsx). A teacher reading
-- that tile wants one place to look, not two, and the text is what gets pasted
-- into a lesson prompt anyway.
--
-- A student cannot write their own `students` row: `students_write_admin` is
-- staff-only, and rightly so — that row carries their module, teacher and fee.
-- So the same trick as 0009's `set_own_avatar`: a security definer function is
-- the column-level grant Postgres won't otherwise give, writing exactly two
-- fields of exactly one row.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0011.
-- Idempotent — safe to re-run.

-- The column ------------------------------------------------------------------
-- Null means "hasn't answered yet", and that is the whole gate: the lessons
-- list stays shut until this is set.

alter table public.students
  add column if not exists onboarded_at timestamptz;

-- A student answering -----------------------------------------------------------

create or replace function public.save_student_onboarding(summary text)
returns void
language plpgsql
security definer
-- Pinned: a security definer function runs as its owner, and an attacker-set
-- search_path is how that privilege gets borrowed.
set search_path = public, pg_temp
as $$
declare
  block text := nullif(trim(coalesce(summary, '')), '');
begin
  if block is null then
    raise exception 'Onboarding summary is empty.';
  end if;

  -- `onboarded_at is null` in the where clause is what makes this once-only:
  -- a second submission matches no row rather than appending the block twice.
  update public.students
     set notes = case
                   when coalesce(trim(notes), '') = '' then block
                   else notes || E'\n\n' || block
                 end,
         onboarded_at = now(),
         updated_at = now()
   where user_id = auth.uid()
     and onboarded_at is null;

  -- No row is not "nothing to do" — it means either an account with no roster
  -- row, or one that has already answered. Silence would look like success.
  if not found then
    raise exception 'No student row awaiting onboarding for the current user.';
  end if;
end;
$$;

revoke all on function public.save_student_onboarding(text) from public;
grant execute on function public.save_student_onboarding(text) to authenticated;
