-- What kind of class a lesson is, and which classes a student's group has had.
--
-- Two things, both for the mobile app's Path tab.
--
-- 1. `lessons.lesson_type`: 'lesson', 'conversation' or 'checkpoint'.
--
--    Until now the only way to tell a conversation class from a regular one was
--    its title — "[Lesson Eight: Conversation] …" — and a title is something a
--    teacher types. The type is now a field of the lesson document
--    (`lessonType`), edited in the Studio next to the module and the unit, and
--    denormalized into this column on every save exactly as `title`, `unit` and
--    `module` are, so the student views can carry it without opening the JSON.
--
--    Book One and Book One [intensivo] are filled in from their titles below,
--    in the column AND the document: the Studio saves the document whole, so a
--    type set only on the column would be overwritten by the first save. Every
--    other lesson gets the default and waits for somebody to set it.
--
-- 2. `student_classes`: the classes of the student's active groups.
--
--    The app suggests the same next lesson the group page does
--    (`suggestNextLesson` in src/features/groups/data/group-classes.ts): the one
--    after the lesson of the most recent class at least one student was present
--    at. A class is the GROUP's — a student who missed it is still moved on with
--    their class. A student cannot read `group_classes` or `group_attendance`
--    (both are `owns_group`), so this view gives them exactly that much: whether
--    each class happened (`held`), and their own mark, for their attendance. It
--    says nothing about anybody else in the room.
--
-- `student_syllabus` and `student_class_plan` get `lesson_type` as their LAST
-- column — `create or replace view` only allows adding columns at the end, and
-- nothing that reads them today notices.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0028, then deploy
-- the web app: the Studio starts writing `lesson_type` on save. The column comes
-- first so the web app still running can keep saving in between — an upsert
-- that doesn't name the column leaves it alone.
-- Idempotent — safe to re-run.

-- The column --------------------------------------------------------------------

alter table public.lessons
  add column if not exists lesson_type text not null default 'lesson';

alter table public.lessons
  drop constraint if exists lessons_lesson_type_check;
alter table public.lessons
  add constraint lessons_lesson_type_check
  check (lesson_type in ('lesson', 'conversation', 'checkpoint'));

-- Filled in from the titles ---------------------------------------------------------
-- Only where the document has no type yet, so running this again never undoes a
-- type set in the Studio since. `updated_at` is left alone: this is a fact about
-- the lessons being written down, not an edit to them, and the library sorts
-- and labels by that date.

alter table public.lessons disable trigger lessons_set_updated_at;

with typed as (
  select
    id,
    case
      when title ~* '^\s*\[[^\]]*:\s*conversation\s*\]' then 'conversation'
      when title ~* 'checkpoint' then 'checkpoint'
      else 'lesson'
    end as lesson_type
  from public.lessons
  where module in ('Book One', 'Book One [intensivo]')
    and document ->> 'lessonType' is null
)
update public.lessons l
set lesson_type = typed.lesson_type,
    document = jsonb_set(l.document, '{lessonType}', to_jsonb(typed.lesson_type))
from typed
where l.id = typed.id;

alter table public.lessons enable trigger lessons_set_updated_at;

-- The student views, with the type ------------------------------------------------
-- Both as they are live (0020 and 0028), with `lesson_type` added at the end.

create or replace view public.student_syllabus as
  select
    l.id,
    l.title,
    l.unit,
    l.module,
    l.position,
    l."order" as course_order,
    exists (
      select 1 from public.student_lessons sl where sl.id = l.id
    ) as available,
    l.lesson_type
  from public.lessons l
  where
    l.module in (select public.current_student_modules())
    or exists (
      select 1 from public.student_lessons sl where sl.id = l.id
    );

revoke all on public.student_syllabus from anon, authenticated;
grant select on public.student_syllabus to authenticated;

create or replace view public.student_class_plan as
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
    exists (
      select 1 from public.student_lessons sl where sl.id = gl.lesson_id
    ) as available,
    -- The base lesson's: a group copy is the same class, rewritten for a group.
    l.lesson_type
  from public.group_lessons gl
  join public.groups g on g.id = gl.group_id
  join public.group_students gs on gs.group_id = gl.group_id
  join public.lessons l on l.id = gl.lesson_id
  left join public.profiles p on p.id = g.teacher_id
  left join lateral (
    select min(c.class_date) as taught_on
    from public.group_classes c
    where c.group_id = gl.group_id
      and c.lesson_id = gl.lesson_id
      and exists (
        select 1 from public.group_attendance a
        where a.class_id = c.id and a.present
      )
  ) taught on true
  where gs.student_id = public.current_student_id()
    and g.status = 'active';

revoke all on public.student_class_plan from anon, authenticated;
grant select on public.student_class_plan to authenticated;

-- The student's classes --------------------------------------------------------------
-- One row per class of each active group the student is in, whether or not they
-- were marked at it.
--
--   held               somebody was present — the class happened. What the next
--                      lesson is counted on from.
--   present, excused   the student's own mark; both null when they weren't
--                      marked. What their attendance is counted from.

drop view if exists public.student_classes;
create view public.student_classes as
  select
    c.id as class_id,
    c.group_id,
    c.lesson_id,
    c.class_date,
    c.starts_at,
    exists (
      select 1 from public.group_attendance a
      where a.class_id = c.id and a.present
    ) as held,
    mine.present,
    mine.excused
  from public.group_classes c
  join public.groups g on g.id = c.group_id
  join public.group_students gs on gs.group_id = c.group_id
  left join public.group_attendance mine
    on mine.class_id = c.id and mine.student_id = gs.student_id
  where gs.student_id = public.current_student_id()
    and g.status = 'active';

revoke all on public.student_classes from anon, authenticated;
grant select on public.student_classes to authenticated;
