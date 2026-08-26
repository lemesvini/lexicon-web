-- A student in a group is taught that group's module, and only that one.
--
-- 0014 let a group's published copies through the module filter, which fixed one
-- problem and created another: a student enrolled in "Book One" whose group is
-- working through "Book One [intensivo]" was then shown BOTH courses at once —
-- the shared Book One library from their profile, and their class's intensivo
-- copies. The two books share their lesson titles, so `/learn` listed
-- "[Lesson One] Nice to meet you!" twice, once per module, with no way to tell
-- which was theirs.
--
-- The rule, corrected: what a student is taught is what their GROUP is working
-- through. If they are in a group with a module, that module is the syllabus and
-- the profile's module does not add a second one. Only when they belong to no
-- group with a module does the profile answer the question — the private student,
-- and the state every student was in before groups existed.
--
-- Within that syllabus the choice per lesson is unchanged and is the one thing
-- this whole feature is for: their class's copy when there is a published one,
-- the shared version otherwise. One row per lesson either way, so nothing is
-- ever listed twice.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0014.
-- Idempotent — safe to re-run.
--
-- SUPERSEDED IN PART BY 0016: the revoke below is wrong — a view calls its
-- functions as the CALLING user, not as the view's owner, so revoking execute
-- from `authenticated` denied every student their own views. 0016 replaces this
-- function with a no-argument one that is granted, and drops this one. Left here
-- as written because it has already been run; run 0016 straight after it.

-- Which course is this student in ------------------------------------------------
-- Returns names because that is what `lessons.module` holds — the link from a
-- lesson to its module is by name, not by key (see 0003).
--
-- Archived groups are skipped: a finished course should not go on deciding what
-- somebody reads. A student in two active groups gets both, which is the honest
-- answer — they are in two courses.
--
-- security definer because it reads `groups` and `group_students`, which a
-- student cannot select from; the views below run as their owner, but the
-- function is also the sort of thing that will be wanted from a policy later.

create or replace function public.student_module_names(p_student uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct m.name
  from public.group_students gs
  join public.groups g on g.id = gs.group_id
  join public.modules m on m.id = g.module_id
  where gs.student_id = p_student
    and g.status = 'active'

  union

  -- The fallback, and only when the group half found nothing at all.
  select m.name
  from public.students s
  join public.modules m on m.id = s.current_module_id
  where s.id = p_student
    and not exists (
      select 1
      from public.group_students gs2
      join public.groups g2 on g2.id = gs2.group_id
      where gs2.student_id = p_student
        and g2.status = 'active'
        and g2.module_id is not null
    );
$$;

revoke all on function public.student_module_names(uuid)
  from public, anon, authenticated;

-- The student's doors, re-cut ------------------------------------------------------
-- One row per lesson, from the syllabus their class is on, carrying their
-- class's copy when there is one.
--
-- A published copy still comes through on its own account: a group may have been
-- given a document from outside its module, and the copy was made FOR these
-- students, which settles it.

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
         or l.module in (
           select public.student_module_names(public.current_student_id())
         )
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
         or l.module in (
           select public.student_module_names(public.current_student_id())
         )
       )
     );

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;
