-- Homework, in the order it is taught.
--
-- `student_homework` has never carried a position, so the only orderable column
-- the student's list had was `updated_at` — the order things were last EDITED.
-- That is a changelog, not a syllabus: re-saving lesson two's homework moved it
-- to the end of the list, and a group's copy, being the most recently touched
-- thing in the module, always sorted last.
--
-- The lesson's own `position` is what the student's lesson list already sorts by
-- (0004 added it for exactly this reason). Homework reaches a student through a
-- lesson, so it inherits that lesson's place in the course.
--
-- The only change to the view is the extra column; the WHERE clause is 0016's,
-- untouched.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0016.
-- Idempotent — safe to re-run.

drop view if exists public.student_homework;
create view public.student_homework as
  select
    h.id,
    h.title,
    h.lesson_id,
    l.title as lesson_title,
    l.module,
    -- Its lesson's place in the module. Not the homework's own: a lesson may
    -- carry more than one, and they are then ordered by title within it.
    l.position,
    public.strip_answer_keys(coalesce(g.document, h.document)) as document,
    greatest(h.updated_at, g.updated_at) as updated_at
  from public.homework h
  join public.lessons l on l.id = h.lesson_id
  left join lateral (
    select gh.document, gh.updated_at
    from public.group_homework gh
    join public.group_students gs on gs.group_id = gh.group_id
    where gh.homework_id = h.id
      and gh.status = 'published'
      and gs.student_id = public.current_student_id()
    order by gh.updated_at desc
    limit 1
  ) g on true
  where g.document is not null
     or (
       h.status = 'published'
       and (
         public.is_staff()
         or l.module in (select public.current_student_modules())
       )
     );

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;
