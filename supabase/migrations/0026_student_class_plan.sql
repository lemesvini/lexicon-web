-- The class plan, as the student sees it.
--
-- The student app's home screen asks two things the student has never been able
-- to read: what is my next class, and what's on this week. Both answers live in
-- the group's plan — `group_lessons` (0010) for the sequence and the projected
-- dates, `group_attendance` (0007) for what has been taught — and both tables
-- are staff-only, because they carry the group's copy of the presentation and
-- the register, neither of which is the student's to read.
--
-- So the plan gets a door of its own, cut like the others: a view owned by the
-- migration runner, whose WHERE clause is the whole access rule. What it lets
-- through is the plan's SHAPE and nothing more — which lessons, in what order,
-- on what day, whether each has been taught. No document, no register, no
-- classmate. The only things read out of a document are the lesson's minor
-- can-do, which the student already gets on the closing slide of their own
-- material, and the teacher's first name, which they know.
--
-- "Taught" is the rule from 0025, unchanged: a lesson is taught on the first day
-- a register records it with somebody present. It is the GROUP's fact, not the
-- student's — a student who missed the class was still in a group that had it,
-- and their next class is the group's next class.
--
-- `scheduled_on` is 0025's projection, rewritten by the app after every register
-- write: taught lessons carry the day they were taught, the rest are laid on the
-- coming meeting days. A date in the past on an untaught lesson means a register
-- nobody has taken yet, not a class that is still to come.
--
-- A student in two active groups gets both plans, one row per group per lesson;
-- `group_id` keeps them apart.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0025.
-- Idempotent — safe to re-run.

drop view if exists public.student_class_plan;
create view public.student_class_plan as
  select
    gl.group_id,
    gl.lesson_id,
    l.title,
    l.unit,
    l.module,
    gl.position,
    l."order" as course_order,
    gl.scheduled_on,
    g.starts_at,
    nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), '') as teacher_first_name,
    -- The group's copy first: a teacher may have rephrased it for the room.
    nullif(
      trim(coalesce(gl.document ->> 'minorCanDo', l.document ->> 'minorCanDo', '')),
      ''
    ) as can_do,
    taught.taught_on,
    -- Whether the student can open the lesson page yet. A lookup into
    -- `student_lessons` rather than a copy of its rule, same as 0020.
    exists (
      select 1 from public.student_lessons sl where sl.id = gl.lesson_id
    ) as available
  from public.group_lessons gl
  join public.groups g on g.id = gl.group_id
  join public.group_students gs on gs.group_id = gl.group_id
  join public.lessons l on l.id = gl.lesson_id
  left join public.profiles p on p.id = g.teacher_id
  left join lateral (
    select min(a.class_date) as taught_on
    from public.group_attendance a
    where a.group_id = gl.group_id
      and a.lesson_id = gl.lesson_id
      and a.present
  ) taught on true
  -- The caller's own active groups, and nobody else's. Staff have no roster
  -- row, so `current_student_id()` is null for them and this returns nothing —
  -- they read the plan from the tables themselves.
  where gs.student_id = public.current_student_id()
    and g.status = 'active';

revoke all on public.student_class_plan from anon, authenticated;
grant select on public.student_class_plan to authenticated;
