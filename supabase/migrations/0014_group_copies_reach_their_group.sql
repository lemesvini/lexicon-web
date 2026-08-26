-- A group's copy reaches the group, whatever the student's profile says.
--
-- 0013 made the student's views prefer a published copy belonging to a group the
-- student is in. It kept 0004's module filter in front of everything, and that
-- filter asks a different question than this feature does:
--
--   the module filter asks   what module is this student enrolled in?
--   a group copy says        this is what THIS class is being taught
--
-- The two disagree the moment a group works through a module the student's
-- profile doesn't name — which is not an edge case, it is the ordinary state of
-- a student on "Book One" in a group doing "Book One [intensivo]". The copy was
-- published, correct, and invisible.
--
-- So membership wins for the group's own copies: a published copy reaches the
-- students of the group it was made for, full stop. The base rows are unchanged
-- and still gated by the module — a student sees the shared library for their
-- own module, plus whatever their class has been given.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0013.
-- Idempotent — safe to re-run.

drop view if exists public.student_lessons;
create view public.student_lessons as
  select
    l.id,
    l.title,
    l.unit,
    l.module,
    l.position,
    coalesce(g.document, m.document) as document,
    greatest(m.updated_at, g.updated_at) as updated_at
  from public.lessons l
  left join public.lesson_materials m
    on m.lesson_id = l.id and m.status = 'published'
  left join lateral (
    select gm.document, gm.updated_at
    from public.group_lesson_materials gm
    join public.group_students gs on gs.group_id = gm.group_id
    where gm.lesson_id = l.id
      and gm.status = 'published'
      and gs.student_id = public.current_student_id()
    order by gm.updated_at desc
    limit 1
  ) g on true
  -- Their class's copy, or the shared material for their own module.
  where g.document is not null
     or (
       m.document is not null
       and (public.is_staff() or l.module = public.current_student_module_name())
     );

revoke all on public.student_lessons from anon, authenticated;
grant select on public.student_lessons to authenticated;

drop view if exists public.student_homework;
create view public.student_homework as
  select
    h.id,
    h.title,
    h.lesson_id,
    l.title as lesson_title,
    l.module,
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
       and (public.is_staff() or l.module = public.current_student_module_name())
     );

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;
