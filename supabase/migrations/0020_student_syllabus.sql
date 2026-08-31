-- The module as a syllabus, in the order it is taught.
--
-- Two things, both about the student's lesson list.
--
-- 1. EVERY LESSON, not just the open ones. `student_lessons` (0016) is the door:
--    a lesson is in it only once somebody has published material for it, and the
--    student's list was built from that. A module of forty-four lessons showed
--    up as "6 aulas" until the rest were written, and the list grew from
--    underneath the student with no way to tell how much course was left.
--
--    `student_syllabus` is the CONTENTS PAGE, not a second door. It carries no
--    document and never will: what it adds over `student_lessons` is the title
--    of a lesson the student cannot yet open, which is exactly what a contents
--    page is for. The app lists an unavailable lesson greyed out and
--    unclickable, and `fetchStudentLesson` still answers from `student_lessons`
--    alone — so nothing here widens what can actually be read.
--
--    `available` is a lookup into `student_lessons`, deliberately, rather than a
--    second copy of its WHERE clause: the rule about what a student may open
--    lives in one place, and this view inherits it instead of drifting from it.
--
-- 2. `position` IS NOT THE COURSE ORDER. It restarts at 1 inside each unit —
--    unit two's first lesson is `position` 1, the same as unit one's — so a list
--    sorted by it interleaves the units: lesson nineteen, lesson one, lesson
--    seven, lesson thirteen. It went unnoticed while only unit one had published
--    material, and showed up the moment the whole syllabus was listed.
--
--    `lessons."order"` is the module-wide sequence — 1 for the first class of
--    the course, counting on across units — and is what the Studio's own lists
--    have always sorted by. Both student views get it, aliased `course_order`:
--    `order` is a PostgREST query parameter, and a column of that name in a
--    `?order=` is a fight not worth having. `position` stays on both views
--    untouched, so nothing that reads it breaks.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0019.
-- Idempotent — safe to re-run.

drop view if exists public.student_syllabus;
create view public.student_syllabus as
  select
    l.id,
    l.title,
    l.unit,
    l.module,
    l.position,
    l."order" as course_order,
    exists (
      select 1 from public.student_lessons sl where sl.id = l.id
    ) as available
  from public.lessons l
  where
    -- Everything in the module the student is working through...
    l.module in (select public.current_student_modules())
    -- ...plus anything they can already open that somehow isn't in it: a group
    -- copy reaches a student through their group, not through their module
    -- (0014), and a lesson they are reading must never vanish from the list it
    -- is read from.
    or exists (
      select 1 from public.student_lessons sl where sl.id = l.id
    );

revoke all on public.student_syllabus from anon, authenticated;
grant select on public.student_syllabus to authenticated;

-- Homework, in the same order --------------------------------------------------
-- 0017 gave the homework list its lesson's `position` to sort by, for the right
-- reason and with the wrong column — so homework interleaves the units exactly
-- as the lesson list did. The view is 0017's, with `course_order` added and
-- nothing else touched.

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
    l."order" as course_order,
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
