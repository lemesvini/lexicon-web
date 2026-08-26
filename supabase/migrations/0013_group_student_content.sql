-- Advanced context, extended to what the student reads.
--
-- 0010 gave a group its own copy of the presentation. That covered the room and
-- stopped at the door: the material the class reads on their own device, and the
-- homework they hand in, were still the same document for every group in the
-- module. So a teacher who added an example for *this* class could project it
-- and could not send it home.
--
-- This migration adds the two missing halves, on exactly the same model as
-- `group_lessons`:
--
--   group_lesson_materials   one group's copy of a lesson's student material
--   group_homework           one group's copy of a homework
--
-- Everything true of `group_lessons` is true of these. The copy is the whole
-- document, not a patch. Blocks the teacher adds carry `advancedContext: true`
-- inside the JSON, which is what the editor locks the base half by.
-- `base_synced_at` records the base row's `updated_at` at the moment of the copy
-- so the app can offer to rebuild rather than pretending the copy is live.
--
-- Two things are new here, because these documents reach students and a
-- presentation never did:
--
--   1. `status`. A group copy is a draft until published, exactly like the base
--      row it came from — editing a copy in front of a class must not be the
--      same act as handing it out.
--
--   2. The student's views have to CHOOSE. `student_lessons` and
--      `student_homework` now prefer a published copy belonging to a group the
--      student is in, and fall back to the base row when there is none. That
--      fallback is what keeps every existing group working untouched: no copy,
--      no change.
--
-- The answer key follows the document the student was actually given. A group
-- copy may add, remove or reword an exercise, so marking against the base
-- document would mark answers to questions they were never asked.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0012.
-- Idempotent — safe to re-run.

-- The copies -------------------------------------------------------------------

create table if not exists public.group_lesson_materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,

  -- The student-facing document: the base material plus whatever this group
  -- added. Same shape as `lesson_materials.document`.
  document jsonb not null,

  status text not null default 'draft'
    check (status in ('draft', 'published')),

  -- `lesson_materials.updated_at` when this copy was made. Null means unknown,
  -- which the app treats as "don't offer to rebuild".
  base_synced_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One copy per group per lesson — what makes "copy the ones I haven't got"
  -- safely repeatable.
  unique (group_id, lesson_id)
);

create index if not exists group_lesson_materials_group_idx
  on public.group_lesson_materials (group_id);

create table if not exists public.group_homework (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  -- `homework.id` is a text slug, like a lesson's.
  homework_id text not null references public.homework(id) on delete cascade,

  document jsonb not null,

  status text not null default 'draft'
    check (status in ('draft', 'published')),

  base_synced_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (group_id, homework_id)
);

create index if not exists group_homework_group_idx
  on public.group_homework (group_id);

-- Timestamps and sanitizing ----------------------------------------------------
-- Both documents are read by students, so both get 0004's write-time strip. The
-- guarantee that nothing addressed to the teacher can sit in a student document
-- has to hold for a group's copy exactly as it does for the base row — the
-- copy is seeded from a presentation often enough that it would otherwise be the
-- easy way to leak an answer key.

drop trigger if exists group_lesson_materials_set_updated_at on public.group_lesson_materials;
create trigger group_lesson_materials_set_updated_at
  before update on public.group_lesson_materials
  for each row execute function public.set_updated_at();

drop trigger if exists group_lesson_materials_sanitize on public.group_lesson_materials;
create trigger group_lesson_materials_sanitize
  before insert or update on public.group_lesson_materials
  for each row execute function public.sanitize_student_document();

drop trigger if exists group_homework_set_updated_at on public.group_homework;
create trigger group_homework_set_updated_at
  before update on public.group_homework
  for each row execute function public.set_updated_at();

drop trigger if exists group_homework_sanitize on public.group_homework;
create trigger group_homework_sanitize
  before insert or update on public.group_homework
  for each row execute function public.sanitize_student_document();

-- Row Level Security -----------------------------------------------------------
-- `owns_group` (0007): admin, or the staff member this group belongs to. The
-- same predicate `group_lessons` uses, for the same reason — a copy made for a
-- group is part of that group. Students never read these tables; they read the
-- views below.

alter table public.group_lesson_materials enable row level security;
alter table public.group_homework enable row level security;

drop policy if exists "group_lesson_materials_own" on public.group_lesson_materials;
create policy "group_lesson_materials_own"
  on public.group_lesson_materials
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id));

drop policy if exists "group_homework_own" on public.group_homework;
create policy "group_homework_own"
  on public.group_homework
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id));

-- Which document is this student's ----------------------------------------------
-- The rule the whole feature turns on: a published copy belonging to a group
-- they are in, or the base row. The two views below spell it out inline (they
-- run as their owner, so they can read these tables directly); this function
-- exists for the marking, which runs as a function and needs the same answer.
--
-- A student can be in more than one group (0007 — a group class and a private
-- slot are both groups), so the pick has to be deterministic. Most recently
-- edited wins: of two copies of the same lesson, the one still being worked on
-- is the one meant for them.
--
-- security definer because the caller is a student and these tables are
-- staff-only under RLS. It takes the student id rather than reading
-- `current_student_id()` so `submit_homework` passes the id it already resolved,
-- and so the answer for one student is never a function of who is asking.

create or replace function public.group_homework_document(
  p_homework_id text,
  p_student uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select gh.document
  from public.group_homework gh
  join public.group_students gs on gs.group_id = gh.group_id
  where gh.homework_id = p_homework_id
    and gh.status = 'published'
    and gs.student_id = p_student
  order by gh.updated_at desc
  limit 1;
$$;

-- NOT granted to callers. It returns a document with its answer key intact, so
-- the only things allowed to call it are the security definer functions below,
-- which run as this function's owner and decide for themselves who is asking.
-- (The same revoke goes on `homework_answer_key`, whose 0005 form has been
-- executable by anyone signed in since it was written.)
revoke all on function public.group_homework_document(text, uuid)
  from public, anon, authenticated;

-- The student's doors, re-cut ----------------------------------------------------
-- Same views as 0006. Two changes, both in the same shape:
--
--   `document` is the group's copy when there is one, else the base row's.
--
--   The row survives if EITHER is published. A group whose copy is published
--   reads it even when the base material is still a draft — which is the point:
--   material written for one class shouldn't wait on the shared one.
--
-- The base row moves to a LEFT join for that second rule. Staff still see the
-- base document (no membership, no copy), which is what makes the preview a
-- preview of the shared material.

drop view if exists public.student_lessons;
create view public.student_lessons as
  select
    l.id,
    l.title,
    l.unit,
    l.module,
    l.position,
    coalesce(g.document, m.document) as document,
    -- GREATEST ignores nulls in Postgres, so this is "whichever of the two we
    -- actually have", not null the moment one is missing.
    greatest(m.updated_at, g.updated_at) as updated_at
  from public.lessons l
  left join public.lesson_materials m
    on m.lesson_id = l.id and m.status = 'published'
  -- The view is owned by the migration runner, so the RLS on the copies does not
  -- apply here — this join IS the access rule, exactly like the WHERE clause.
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
  where coalesce(g.document, m.document) is not null
    and (public.is_staff() or l.module = public.current_student_module_name());

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
    -- The key is stripped from whichever document won, not just from the base:
    -- a group copy carries its own answers and reaches the same student.
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
  -- Published either way round. A base row still in draft reaches nobody who
  -- hasn't been given a copy of it.
  where (g.document is not null or h.status = 'published')
    and (public.is_staff() or l.module = public.current_student_module_name());

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;

-- Marking against the document they were given -----------------------------------
-- The 0005 function read `homework.document` and nothing else. A group copy may
-- add an exercise, drop one, or change an answer — so marking a copy's answers
-- against the base would mark questions the student was never asked, and score
-- ones they were as wrong.
--
-- The one-argument form is kept (nothing else calls it, but a stable-named
-- function in a migration is cheap) and now delegates.

create or replace function public.homework_answer_key(
  p_homework_id text,
  p_student uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(b.block ->> 'id', b.block -> 'answer'), '{}'::jsonb)
  from (
    select coalesce(
      public.group_homework_document(p_homework_id, p_student),
      (select h.document from public.homework h where h.id = p_homework_id)
    ) as document
  ) d,
  lateral jsonb_array_elements(coalesce(d.document -> 'slides', '[]'::jsonb)) as slide,
  lateral jsonb_array_elements(coalesce(slide -> 'blocks', '[]'::jsonb)) as b(block)
  where b.block ? 'id'
    and b.block ? 'answer';
$$;

revoke all on function public.homework_answer_key(text, uuid)
  from public, anon, authenticated;
revoke all on function public.homework_answer_key(text)
  from public, anon, authenticated;

-- What this student was actually asked ------------------------------------------
-- For the correction screen. A submission records the answers and the key it was
-- marked against, but the questions themselves were only ever in a document —
-- and if the student's group had a copy, the base homework is the wrong one to
-- read them from: renumbered, reworded, or holding an exercise they never saw.
--
-- Staff-gated inside the body rather than by the grant, because the grant has to
-- be to `authenticated` for PostgREST to expose it at all.

create or replace function public.submission_document(
  p_homework_id text,
  p_student uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_staff() then coalesce(
      public.group_homework_document(p_homework_id, p_student),
      (select h.document from public.homework h where h.id = p_homework_id)
    )
  end;
$$;

grant execute on function public.submission_document(text, uuid) to authenticated;

-- `submit_homework`, re-cut: the only change is the key it snapshots.
create or replace function public.submit_homework(
  p_homework_id text,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_status text;
  v_key jsonb;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  v_student := public.current_student_id();
  if v_student is null then
    raise exception 'Only an active student can answer homework.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.student_homework where id = p_homework_id) then
    raise exception 'That homework is not available to you.' using errcode = '42501';
  end if;

  select status into v_status
  from public.homework_submissions
  where homework_id = p_homework_id and student_id = v_student;

  if v_status is not null and v_status <> 'in_progress' then
    raise exception 'This homework has already been handed in.';
  end if;

  v_key := public.homework_answer_key(p_homework_id, v_student);

  insert into public.homework_submissions (
    homework_id, student_id, answers, status, submitted_at, answer_key, marks
  )
  values (
    p_homework_id, v_student, v_answers, 'submitted', now(), v_key,
    public.mark_answers(v_key, v_answers)
  )
  on conflict (homework_id, student_id)
  do update set
    answers      = excluded.answers,
    status       = 'submitted',
    submitted_at = now(),
    answer_key   = excluded.answer_key,
    marks        = excluded.marks;
end;
$$;
