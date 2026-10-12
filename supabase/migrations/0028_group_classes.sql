-- A class is a thing of its own: a lesson, a day, a time, and who was there.
--
-- Until now a "class" only existed as the rows of `group_attendance` that
-- happened to share a group and a date. Each row carried its own copy of the
-- lesson, stamped by whichever tap wrote it, and there was nowhere to keep the
-- class's own facts — when it started, what it was for — because there was no
-- row for the class itself. The lesson picked before the first mark lived only in
-- the page's memory, and the "next lesson" was the first one never taught rather
-- than the one after the last class.
--
-- Now:
--
--   group_classes      one row per class that happened: the group, the lesson
--                      taught, the date, and the time it started (pre-filled
--                      from `groups.starts_at`, but what actually happened). A
--                      group may have more than one class on a day, at different
--                      times.
--   group_attendance   one row per student per class, hanging off `class_id`.
--                      The date and the lesson move to the class; `group_id`
--                      stays, pinned to the class's by a composite foreign key,
--                      because RLS and the group-wide tallies read it.
--
-- A class is saved whole, in one call to `save_group_class` — lesson, date, time
-- and every mark together, in a transaction — when the teacher presses Save.
--
-- The plan reads one rule off this: a lesson is taught by a class with at least
-- one student present, and the suggested next lesson is the one after the most
-- recent such class.
--
-- Existing registers are carried over: one class per (group, date) that had
-- marks, with the first lesson recorded that day and the group's usual time.
--
-- `student_class_plan` (0027) reads the date and lesson through the class now;
-- its columns are unchanged, so the mobile app doesn't notice.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0027, and deploy
-- the web app straight after: the old register writes `class_date` and
-- `lesson_id` onto attendance rows, which this drops.
-- Idempotent — safe to re-run.

create table if not exists public.group_classes (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  lesson_id    text references public.lessons (id) on delete set null,
  class_date   date not null,
  starts_at    time,
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Two classes at the same hour on the same day is a double submit, not a
  -- timetable. No fixed hour counts as one slot, hence NULLS NOT DISTINCT.
  constraint group_classes_slot_key unique nulls not distinct (group_id, class_date, starts_at),
  -- The target of the composite key below.
  constraint group_classes_id_group_key unique (id, group_id)
);

create index if not exists group_classes_group_date_idx
  on public.group_classes (group_id, class_date desc, starts_at desc);

alter table public.group_classes enable row level security;

drop policy if exists "group_classes_own" on public.group_classes;
create policy "group_classes_own"
  on public.group_classes
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id));

grant select, insert, update, delete on public.group_classes to authenticated;

alter table public.group_attendance
  add column if not exists class_id uuid;

-- Carry the old registers over. Guarded on `class_date` still being there, so a
-- second run — after the column is gone — skips it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'group_attendance'
      and column_name = 'class_date'
  ) then
    insert into public.group_classes
      (group_id, lesson_id, class_date, starts_at, recorded_by, created_at, updated_at)
    select
      a.group_id,
      (array_agg(a.lesson_id order by a.created_at)
        filter (where a.lesson_id is not null))[1],
      a.class_date,
      g.starts_at,
      (array_agg(a.recorded_by order by a.created_at))[1],
      min(a.created_at),
      max(a.created_at)
    from public.group_attendance a
    join public.groups g on g.id = a.group_id
    where a.class_id is null
    group by a.group_id, a.class_date, g.starts_at
    on conflict do nothing;

    update public.group_attendance a
    set class_id = c.id
    from public.group_classes c
    join public.groups g on g.id = c.group_id
    where a.class_id is null
      and c.group_id = a.group_id
      and c.class_date = a.class_date
      and c.starts_at is not distinct from g.starts_at;
  end if;
end;
$$;

alter table public.group_attendance
  alter column class_id set not null;

alter table public.group_attendance
  drop constraint if exists group_attendance_class_fkey;
alter table public.group_attendance
  add constraint group_attendance_class_fkey
  foreign key (class_id, group_id)
  references public.group_classes (id, group_id)
  on delete cascade;

alter table public.group_attendance
  drop constraint if exists group_attendance_group_id_student_id_class_date_key;
alter table public.group_attendance
  drop constraint if exists group_attendance_class_student_key;
alter table public.group_attendance
  add constraint group_attendance_class_student_key unique (class_id, student_id);

-- The view reads the two columns about to go; rebuilt below through the class.
drop view if exists public.student_class_plan;

alter table public.group_attendance drop column if exists class_date;
alter table public.group_attendance drop column if exists lesson_id;

create index if not exists group_attendance_student_idx
  on public.group_attendance (student_id);

-- 0027's view, with `taught_on` read through `group_classes`. Same columns.
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
    ) as available
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

-- Saves a class whole: the class row and every mark, in one transaction.
--
--   p_class_id  null for a new class, the class's id to edit one
--   p_marks     [{ "student_id": uuid, "present": bool, "excused": bool }, …]
--               — the complete register. A student left out has no mark for
--               this class afterwards, even if they had one before: "not
--               marked" is the absence of a row.
--
-- Security invoker, so the RLS above decides whether the caller may: a teacher
-- can only record a class for their own group, and only mark their own students.
-- A day marked as "no class" stops being one once a class is recorded on it.
create or replace function public.save_group_class(
  p_class_id   uuid,
  p_group_id   uuid,
  p_lesson_id  text,
  p_class_date date,
  p_starts_at  time,
  p_marks      jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_class_id uuid := p_class_id;
begin
  if v_class_id is null then
    insert into group_classes (group_id, lesson_id, class_date, starts_at)
    values (p_group_id, p_lesson_id, p_class_date, p_starts_at)
    returning id into v_class_id;
  else
    update group_classes
    set lesson_id = p_lesson_id,
        class_date = p_class_date,
        starts_at = p_starts_at,
        updated_at = now()
    where id = v_class_id and group_id = p_group_id;
    if not found then
      raise exception 'That class is no longer there.';
    end if;
  end if;

  delete from group_attendance a
  where a.class_id = v_class_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) m
      where (m ->> 'student_id')::uuid = a.student_id
    );

  insert into group_attendance (class_id, group_id, student_id, present, excused)
  select
    v_class_id,
    p_group_id,
    (m ->> 'student_id')::uuid,
    coalesce((m ->> 'present')::boolean, false),
    not coalesce((m ->> 'present')::boolean, false)
      and coalesce((m ->> 'excused')::boolean, false)
  from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) m
  on conflict (class_id, student_id) do update
  set present = excluded.present,
      excused = excluded.excused;

  delete from group_cancelled_classes
  where group_id = p_group_id and class_date = p_class_date;

  return v_class_id;
exception
  when unique_violation then
    raise exception 'This group already has a class recorded at that date and time.'
      using errcode = 'P0001';
end;
$$;

grant execute on function public.save_group_class(uuid, uuid, text, date, time, jsonb) to authenticated;
