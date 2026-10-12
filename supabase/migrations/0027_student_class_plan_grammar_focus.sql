-- The class plan's grammar focus, for the student's next-class card.
--
-- 0026's view, with one column added: `grammar_focus`, the lesson's
-- `grammarFocus` array (see src/lib/lessons.ts). Read the same way as `can_do`
-- — the group's copy first, because a teacher may have trimmed it for the room
-- (one class's Lesson Eight drops "Should" from its modal verbs), then the base
-- lesson. Like the can-do, it is a heading the student already sees on their own
-- material, not anything addressed to the teacher.
--
-- Always a JSON array, `[]` when neither document has one, so the app has a list
-- to map rather than a null to guard.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0026.
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
    case
      when jsonb_typeof(gl.document -> 'grammarFocus') = 'array' then gl.document -> 'grammarFocus'
      when jsonb_typeof(l.document -> 'grammarFocus') = 'array' then l.document -> 'grammarFocus'
      else '[]'::jsonb
    end as grammar_focus,
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
  -- row, so `current_student_id()` is null for them and this returns nothing.
  where gs.student_id = public.current_student_id()
    and g.status = 'active';

revoke all on public.student_class_plan from anon, authenticated;
grant select on public.student_class_plan to authenticated;
