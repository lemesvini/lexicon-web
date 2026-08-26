-- Repairs 0015, which locked the students out of their own views.
--
-- 0015 revoked EXECUTE on `student_module_names(uuid)` from `authenticated`, on
-- the reasoning that the views calling it run as their owner and so need no
-- grant of their own. That is true of the TABLES a view reads. It is not true of
-- the FUNCTIONS it calls: execute permission is checked against the calling
-- user, even inside a view — so every student got
--
--   42501: permission denied for function student_module_names
--
-- and `/learn` went blank.
--
-- The grant has to exist. Rather than handing back a function that takes any
-- student id — which any signed-in student could then call for somebody else —
-- the parameter goes away: `current_student_modules()` answers for the caller
-- and nobody else, the same shape as `current_student_id()` and
-- `current_student_module_name()` from 0005, which have always been callable for
-- exactly that reason.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0015.
-- Idempotent — safe to re-run.

create or replace function public.current_student_modules()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  -- What the caller's active groups are working through. Archived groups are
  -- skipped: a finished course should not go on deciding what somebody reads.
  select distinct m.name
  from public.group_students gs
  join public.groups g on g.id = gs.group_id
  join public.modules m on m.id = g.module_id
  where gs.student_id = public.current_student_id()
    and g.status = 'active'

  union

  -- The fallback, and only when the group half found nothing at all: the module
  -- on their own record. The private student, and the state every student was
  -- in before groups existed.
  select public.current_student_module_name()
  where not exists (
    select 1
    from public.group_students gs2
    join public.groups g2 on g2.id = gs2.group_id
    where gs2.student_id = public.current_student_id()
      and g2.status = 'active'
      and g2.module_id is not null
  );
$$;

grant execute on function public.current_student_modules() to authenticated;

-- The views, pointed at the callable one -------------------------------------

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
  where g.document is not null
     or (
       m.document is not null
       and (
         public.is_staff()
         or l.module in (select public.current_student_modules())
       )
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
       and (
         public.is_staff()
         or l.module in (select public.current_student_modules())
       )
     );

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;

-- The version nothing calls any more.
drop function if exists public.student_module_names(uuid);
