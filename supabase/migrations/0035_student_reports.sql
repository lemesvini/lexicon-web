-- The student's own progress reports, for the mobile app's Me tab.
--
-- `student_unit_reports` (0010) is staff-only, and stays that way: it holds
-- `teacher_notes`, the teacher's read on a test, which is not written for the
-- student. 0010 named the way in should a student view ever be wanted — a view
-- like `student_lessons` (0004), not a policy on the table — and this is it.
--
-- It carries what the teacher writes for the record of the unit — what happened
-- over it, and the test score — and leaves `teacher_notes` and the authorship
-- columns out. Scoped to the signed-in student by `current_student_id()`, so
-- the app never filters by who is asking.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0034.
-- Idempotent — safe to re-run.

drop view if exists public.student_reports;
create view public.student_reports as
  select
    r.id,
    r.module_id,
    m.name as module,
    r.unit,
    r.observations,
    r.test_score,
    r.updated_at
  from public.student_unit_reports r
  join public.modules m on m.id = r.module_id
  where r.student_id = public.current_student_id();

revoke all on public.student_reports from anon, authenticated;
grant select on public.student_reports to authenticated;
