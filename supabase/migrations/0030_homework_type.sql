-- What kind of homework it is: the lesson's activities, or its "now you can".
--
-- `homework.title` is the homework's own name ("L8 Activities") and stays as it
-- is. The type is the step it stands for in a lesson, and it is what the mobile
-- app's lesson page names that step with. Set in the Studio's homework editor,
-- next to the lesson it is attached to — a column like `lesson_id`, not a field
-- of the document: it is about where the homework sits, not what it says.
--
-- Every homework so far is a lesson's activities, so that is the default and
-- nothing needs filling in.
--
-- `student_homework` gets it as its LAST column: `create or replace view` only
-- allows adding columns at the end, and nothing that reads the view notices.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0029, then deploy
-- the web app: the Studio starts reading and writing `homework_type`. The column
-- comes first so the web app still running can keep saving in between.
-- Idempotent — safe to re-run.

alter table public.homework
  add column if not exists homework_type text not null default 'activities';

alter table public.homework
  drop constraint if exists homework_homework_type_check;
alter table public.homework
  add constraint homework_homework_type_check
  check (homework_type in ('activities', 'now-you-can'));

-- The student's view, as it is live (0020), with the type added at the end. A
-- group's copy is the same homework, rewritten for the group: it takes the
-- shared one's type.
create or replace view public.student_homework as
  select
    h.id,
    h.title,
    h.lesson_id,
    l.title as lesson_title,
    l.module,
    l.position,
    l."order" as course_order,
    public.strip_answer_keys(coalesce(g.document, h.document)) as document,
    greatest(h.updated_at, g.updated_at) as updated_at,
    h.homework_type
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
