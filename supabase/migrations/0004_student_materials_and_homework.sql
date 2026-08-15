-- Student materials and homework: what the student actually reads.
--
-- Until now the student side was access without content — `/learn` listed the
-- titles of the lessons in their module and stopped there. This migration adds
-- the two things they read, and closes a hole the listing left open.
--
--   lesson_materials  the student-facing version of a lesson, one per lesson
--   homework          exercises, optionally attached to a lesson
--   student_lessons   \ the two views the student reads, already filtered by
--   student_homework  / module and by publication status
--
-- Three ideas hold this together:
--
--   1. The presentation and the student's material are DIFFERENT DOCUMENTS, not
--      one document rendered two ways. 0002 gave students select on the whole
--      `lessons` row, and RLS is row-level: `select document` handed them every
--      teacher note and answer key in their module. Filtering in the client
--      would not have fixed that. So `lessons` closes to admins entirely, and
--      the student reads a document authored for them.
--
--   2. Students read VIEWS, admins read TABLES. Both new tables are admin-only
--      under RLS. The views below are owned by the migration runner and so are
--      not subject to that RLS — their WHERE clause is the access rule, which
--      is why it is written out in full rather than leaning on a policy.
--
--   3. Nothing marked for the teacher can be stored in a student document at
--      all. `strip_teacher_content` runs on every write (see the trigger), so
--      the guarantee does not depend on the editor getting it right.
--
-- Run this in the Supabase SQL editor after 0003. Idempotent — safe to re-run.
--
-- IMPORTANT: this migration and the app changes in the same PR go out together.
-- On its own it closes `lessons` to students and the current `/learn` (which
-- calls `listCloudLessons`) goes empty.

-- Curriculum order ------------------------------------------------------------
-- The student's lesson list is a syllabus, not a changelog: `/learn` ordering by
-- `updated_at` meant re-saving lesson 1 moved it to the top of the module.

alter table public.lessons
  add column if not exists position integer not null default 0;

create index if not exists lessons_module_position_idx
  on public.lessons (module, position);

-- Sanitizing student documents ------------------------------------------------
-- Strips everything addressed to the teacher out of a lesson document: the
-- per-slide `teacherNotes`, and any block carrying `audience: "teacher"` (answer
-- keys, profile cards — see isTeacherOnly in src/features/blocks/registry.ts).
--
-- Deliberately a database-side rule rather than a client-side filter: the row is
-- what the student can fetch, so the row is where the guarantee has to live.
--
-- `with ordinality` + `order by` are load-bearing, not decoration: jsonb_agg
-- follows scan order, and relying on that to keep a lesson's slides in sequence
-- would be trusting an implementation detail with the whole document.

create or replace function public.strip_teacher_content(doc jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    coalesce(doc, '{}'::jsonb),
    '{slides}',
    coalesce(
      (
        select jsonb_agg(
          (s.slide - 'teacherNotes')
          || jsonb_build_object(
               'blocks',
               coalesce(
                 (
                   select jsonb_agg(b.block order by b.ord)
                   from jsonb_array_elements(
                     coalesce(s.slide -> 'blocks', '[]'::jsonb)
                   ) with ordinality as b(block, ord)
                   where b.block ->> 'audience' is distinct from 'teacher'
                 ),
                 '[]'::jsonb
               )
             )
          order by s.ord
        )
        from jsonb_array_elements(
          coalesce(doc -> 'slides', '[]'::jsonb)
        ) with ordinality as s(slide, ord)
      ),
      '[]'::jsonb
    ),
    true
  );
$$;

create or replace function public.sanitize_student_document()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.document := public.strip_teacher_content(new.document);
  return new;
end;
$$;

-- Lesson materials ------------------------------------------------------------
-- One per lesson, keyed by it: the material IS the student's copy of that
-- lesson, so it carries no title or module of its own — those come from the
-- lesson, and there is no second copy to drift.
--
-- `document` is the same shape as `lessons.document` (see src/lib/lessons.ts):
-- meta plus a `slides` array of blocks. The student surface renders those slides
-- as sections of a scrollable page rather than as a deck, but the shape is
-- shared so a material can be seeded from the presentation with a copy.

create table if not exists public.lesson_materials (
  lesson_id   text primary key references public.lessons (id) on delete cascade,
  document    jsonb not null,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists lesson_materials_set_updated_at on public.lesson_materials;
create trigger lesson_materials_set_updated_at
  before update on public.lesson_materials
  for each row
  execute function public.set_updated_at();

drop trigger if exists lesson_materials_sanitize on public.lesson_materials;
create trigger lesson_materials_sanitize
  before insert or update on public.lesson_materials
  for each row
  execute function public.sanitize_student_document();

-- Homework --------------------------------------------------------------------
-- Its own slug id, like a lesson, because homework is authored on its own and
-- attached afterwards. `lesson_id` is nullable on purpose: "create it now, link
-- it to a lesson later" is the intended workflow, and an unlinked homework is a
-- draft in the backlog — the student view joins through `lesson_id`, so it is
-- invisible to students until it has one.
--
-- on delete set null (not cascade): deleting a lesson should orphan its homework
-- for re-filing, not destroy work that may be reusable.

create table if not exists public.homework (
  id          text primary key,
  title       text not null default '',
  lesson_id   text references public.lessons (id) on delete set null,
  document    jsonb not null,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists homework_lesson_idx on public.homework (lesson_id);

drop trigger if exists homework_set_updated_at on public.homework;
create trigger homework_set_updated_at
  before update on public.homework
  for each row
  execute function public.set_updated_at();

drop trigger if exists homework_sanitize on public.homework;
create trigger homework_sanitize
  before insert or update on public.homework
  for each row
  execute function public.sanitize_student_document();

-- Row Level Security ----------------------------------------------------------
-- Both tables are admin-only, full stop. Students never touch them: they read
-- the two views below.
--
-- Writes are gated on is_admin() rather than on `created_by = auth.uid()` the
-- way `lessons` is. That ownership rule is what forced every module edit in 0003
-- to become a security definer RPC, and there is no reason to inherit it here —
-- the curriculum is admin-managed, not per-teacher property.

alter table public.lesson_materials enable row level security;
alter table public.homework enable row level security;

drop policy if exists "lesson_materials_admin" on public.lesson_materials;
create policy "lesson_materials_admin"
  on public.lesson_materials
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "homework_admin" on public.homework;
create policy "homework_admin"
  on public.homework
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Close the lesson library ----------------------------------------------------
-- Replaces the policy from 0002, which let a student read every lesson row in
-- their module — `document` and all. Students now get their content from
-- `student_lessons` instead.

drop policy if exists "lessons_select_admin_or_own_module" on public.lessons;
drop policy if exists "lessons_select_admin" on public.lessons;
create policy "lessons_select_admin"
  on public.lessons
  for select
  to authenticated
  using (public.is_admin());

-- The student's doors ---------------------------------------------------------
-- These views run with the privileges of their owner, so the RLS on the tables
-- they read does not apply and the WHERE clause below is the whole access rule.
-- Read it as: published, and in the module this student is currently active in.
--
-- Supabase grants new objects in `public` to `anon` and `authenticated` by
-- default. For an anonymous caller auth.uid() is null, so is_admin() is false
-- and current_student_module_name() is null — and `module = null` is null, never
-- true, so the views return nothing. The revoke below makes that explicit rather
-- than leaving it to that argument holding.

drop view if exists public.student_lessons;
create view public.student_lessons as
  select
    l.id,
    l.title,
    l.unit,
    l.module,
    l.position,
    m.document,
    m.updated_at
  from public.lesson_materials m
  join public.lessons l on l.id = m.lesson_id
  where m.status = 'published'
    and (public.is_admin() or l.module = public.current_student_module_name());

-- Revoked from `authenticated` too, not just `anon`: Supabase's default grant is
-- ALL, and a view arriving with insert/update/delete attached is not something to
-- leave standing on the argument that a join view isn't auto-updatable anyway.
revoke all on public.student_lessons from anon, authenticated;
grant select on public.student_lessons to authenticated;

-- Homework reaches a student through its lesson: the join drops anything not yet
-- attached, and the same module check applies. A published homework hanging off
-- a lesson whose material is still a draft is visible here but has no lesson
-- page to appear on — that inconsistency belongs in the Studio as a warning,
-- rather than being papered over by the view withholding published work.

drop view if exists public.student_homework;
create view public.student_homework as
  select
    h.id,
    h.title,
    h.lesson_id,
    h.document,
    h.updated_at
  from public.homework h
  join public.lessons l on l.id = h.lesson_id
  where h.status = 'published'
    and (public.is_admin() or l.module = public.current_student_module_name());

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;

-- Seed ------------------------------------------------------------------------
-- A draft material for every lesson that already exists, copied from the
-- presentation with the teacher's half removed. Without this the Studio would
-- open on an empty page for every lesson in the library; with it, authoring a
-- material starts as trimming rather than as retyping.
--
-- DRAFT, not published, and that is a deliberate trade: until you publish them,
-- `/learn` shows nothing, where before it at least listed lesson titles. The
-- alternative — publishing automatically — would put slides written to be
-- projected in front of students as if they had been written for them, which is
-- the whole thing this feature exists to stop.
--
-- If you would rather close that gap immediately and trim afterwards:
--   update public.lesson_materials set status = 'published';

insert into public.lesson_materials (lesson_id, document, status)
select l.id, public.strip_teacher_content(l.document), 'draft'
from public.lessons l
on conflict (lesson_id) do nothing;
