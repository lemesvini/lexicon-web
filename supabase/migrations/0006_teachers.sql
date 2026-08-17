-- Teachers: a second kind of staff account, and students that belong to one.
--
-- Until now "admin" meant two different things at once — the person who runs the
-- school, and the person who teaches a class — because they were the same
-- person. With more than one teacher those come apart:
--
--   admin    runs the school. Sees every student, and is the only role that can
--            create or deactivate a teacher.
--   teacher  teaches. Gets the same app the admin has today, minus /teachers,
--            and sees only the students they created.
--   student  unchanged.
--
-- What is NOT split: the curriculum. Lessons, modules, materials and homework
-- stay one shared library that every teacher reads and edits, and a student's
-- access to their module works exactly as it did before. Only the roster — who
-- a student belongs to, and therefore whose corrections queue their homework
-- lands in — is per-teacher.
--
-- The rule everywhere below is one of two predicates:
--
--   is_staff()          admin or active teacher — used for the shared curriculum
--   owns_student(id)    admin, or the teacher that student belongs to
--
-- `is_admin()` keeps its old, narrow meaning and is now only what it says on the
-- tin. Every policy that used it to mean "any teacher" is rewritten here.
--
-- Run this in the Supabase SQL editor after 0005. Idempotent — safe to re-run.
--
-- IMPORTANT: this migration and the app changes in the same PR go out together,
-- and the two Edge Functions have to be redeployed with them:
--   supabase functions deploy admin-create-student
--   supabase functions deploy admin-reset-student-password
--   supabase functions deploy admin-create-teacher
--   supabase functions deploy admin-reset-teacher-password

-- Roles -----------------------------------------------------------------------
-- 'teacher' joins the two roles from 0002. The check constraint is dropped and
-- rebuilt rather than altered — Postgres has no ALTER CONSTRAINT for a CHECK.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'teacher', 'student'));

-- Whether a staff account is still in use. A teacher who leaves is deactivated,
-- not deleted: their students, their lessons and their corrections all reference
-- them, and deleting the row would either cascade through that history or strand
-- it. `is_staff()` below is what actually closes the door.
--
-- Only meaningful for teachers. An admin is never offered the toggle (see
-- src/features/teachers), and is_staff() ignores it for them anyway, so there is
-- no way to lock the school out of its own admin account.
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

-- Is the caller staff — admin or an active teacher?
--
-- security definer for the same reason as is_admin() (see 0002): it reads
-- `profiles`, and is used inside policies on tables whose own policies would
-- otherwise re-enter.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or (role = 'teacher' and status = 'active'))
  );
$$;

grant execute on function public.is_staff() to authenticated;

-- Who a student belongs to -----------------------------------------------------
-- Separate from `created_by`, which is an audit column: the admin can create a
-- student on a teacher's behalf, and a student can be handed to another teacher
-- later. `teacher_id` is the live relationship, `created_by` is history.
--
-- References `profiles` rather than `auth.users` (which is what created_by does)
-- so PostgREST can embed the teacher's name on a roster query.

alter table public.students
  add column if not exists teacher_id uuid references public.profiles (id) on delete set null;

create index if not exists students_teacher_idx on public.students (teacher_id);

-- Backfill: every student so far was created by the founding admin, so that is
-- who they belong to. Guarded on the profile existing, because `created_by` can
-- point at an auth user whose profile row was never made.
update public.students s
set teacher_id = s.created_by
where s.teacher_id is null
  and exists (select 1 from public.profiles p where p.id = s.created_by);

-- Anything left over (no creator recorded) goes to the oldest admin, so no
-- student ends up belonging to nobody and invisible on every roster.
update public.students s
set teacher_id = (
  select p.id from public.profiles p
  where p.role = 'admin'
  order by p.created_at
  limit 1
)
where s.teacher_id is null;

-- Is this student the caller's to see and edit?
create or replace function public.owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_staff()
      and exists (
        select 1 from public.students s
        where s.id = p_student_id
          and s.teacher_id = auth.uid()
      )
    );
$$;

grant execute on function public.owns_student(uuid) to authenticated;

-- The roster ------------------------------------------------------------------
-- Three ways in: it's your own row (the student), you're the admin, or you're
-- the active teacher it belongs to.

drop policy if exists "students_select_own_or_admin" on public.students;
drop policy if exists "students_select_own_or_teacher" on public.students;
create policy "students_select_own_or_teacher"
  on public.students
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_staff() and teacher_id = auth.uid())
  );

-- WITH CHECK carries the weight on writes: a teacher can only create or keep a
-- student whose `teacher_id` is themselves, so there is no way to insert into
-- someone else's roster or to move a student off your own.
drop policy if exists "students_write_admin" on public.students;
drop policy if exists "students_write_own" on public.students;
create policy "students_write_own"
  on public.students
  for all
  to authenticated
  using (public.is_admin() or (public.is_staff() and teacher_id = auth.uid()))
  with check (public.is_admin() or (public.is_staff() and teacher_id = auth.uid()));

drop policy if exists "student_modules_select_own_or_admin" on public.student_modules;
drop policy if exists "student_modules_select_own_or_teacher" on public.student_modules;
create policy "student_modules_select_own_or_teacher"
  on public.student_modules
  for select
  to authenticated
  using (
    public.owns_student(student_id)
    or exists (
      select 1 from public.students s
      where s.id = student_modules.student_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "student_modules_write_admin" on public.student_modules;
drop policy if exists "student_modules_write_own" on public.student_modules;
create policy "student_modules_write_own"
  on public.student_modules
  for all
  to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- Corrections ------------------------------------------------------------------
-- A submission follows its student: it reaches the queue of whoever that student
-- belongs to, and the admin's. The student's own reads still go through
-- `student_submissions` (0005), which is scoped by current_student_id() and is
-- untouched by this.

drop policy if exists "homework_submissions_admin" on public.homework_submissions;
drop policy if exists "homework_submissions_teacher" on public.homework_submissions;
create policy "homework_submissions_teacher"
  on public.homework_submissions
  for all
  to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- The shared curriculum --------------------------------------------------------
-- Everything from here down is the same rule it always was, with is_admin()
-- widened to is_staff(). One library, every teacher in it.

drop policy if exists "modules_write_admin" on public.modules;
drop policy if exists "modules_write_staff" on public.modules;
create policy "modules_write_staff"
  on public.modules
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lessons_select_admin" on public.lessons;
drop policy if exists "lessons_select_staff" on public.lessons;
create policy "lessons_select_staff"
  on public.lessons
  for select
  to authenticated
  using (public.is_staff());

-- Insert still stamps the author (the column defaults to auth.uid(), and this
-- makes sure it isn't overridden), but update and delete open up to any teacher:
-- the Studio lists the whole library to everyone, and a shared library you can
-- open but not save is a worse trap than a shared library you can edit.
drop policy if exists "lessons_insert_own" on public.lessons;
create policy "lessons_insert_own"
  on public.lessons
  for insert
  to authenticated
  with check (public.is_staff() and created_by = auth.uid());

drop policy if exists "lessons_update_own" on public.lessons;
drop policy if exists "lessons_update_staff" on public.lessons;
create policy "lessons_update_staff"
  on public.lessons
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "lessons_delete_own" on public.lessons;
drop policy if exists "lessons_delete_staff" on public.lessons;
create policy "lessons_delete_staff"
  on public.lessons
  for delete
  to authenticated
  using (public.is_staff());

drop policy if exists "lesson_materials_admin" on public.lesson_materials;
drop policy if exists "lesson_materials_staff" on public.lesson_materials;
create policy "lesson_materials_staff"
  on public.lesson_materials
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "homework_admin" on public.homework;
drop policy if exists "homework_staff" on public.homework;
create policy "homework_staff"
  on public.homework
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- The student's doors, re-cut --------------------------------------------------
-- Same views as 0004/0005. The only change is the staff branch of the WHERE
-- clause, which is what lets a teacher preview what their students will read.

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
    public.strip_answer_keys(h.document) as document,
    h.updated_at
  from public.homework h
  join public.lessons l on l.id = h.lesson_id
  where h.status = 'published'
    and (public.is_staff() or l.module = public.current_student_module_name());

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;

-- Module management, re-cut ----------------------------------------------------
-- The three RPCs from 0003, with their gate widened the same way. Their bodies
-- are otherwise unchanged — see 0003 for why they exist at all.

create or replace function public.set_lessons_module(
  lesson_ids text[],
  module_name text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  if not public.is_staff() then
    raise exception 'Only a teacher can change lesson modules.' using errcode = '42501';
  end if;

  update public.lessons
  set module = module_name,
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(module_name),
        true
      )
  where id = any(lesson_ids);

  get diagnostics updated = row_count;
  return updated;
end;
$$;

grant execute on function public.set_lessons_module(text[], text) to authenticated;

create or replace function public.rename_module(module_id uuid, new_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
  updated integer;
begin
  if not public.is_staff() then
    raise exception 'Only a teacher can rename a module.' using errcode = '42501';
  end if;

  new_name := trim(new_name);
  if new_name = '' then
    raise exception 'A module needs a name.';
  end if;

  select name into old_name from public.modules where id = module_id;
  if old_name is null then
    raise exception 'Module not found.';
  end if;
  if old_name = new_name then
    return 0;
  end if;

  if exists (select 1 from public.modules where name = new_name) then
    raise exception 'There is already a module called "%".', new_name;
  end if;

  update public.modules set name = new_name where id = module_id;

  update public.lessons
  set module = new_name,
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(new_name),
        true
      )
  where module = old_name;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

grant execute on function public.rename_module(uuid, text) to authenticated;

create or replace function public.delete_module(module_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
begin
  if not public.is_staff() then
    raise exception 'Only a teacher can delete a module.' using errcode = '42501';
  end if;

  select name into old_name from public.modules where id = module_id;
  if old_name is null then
    raise exception 'Module not found.';
  end if;

  -- Deliberately checked across every teacher's roster, not just the caller's:
  -- the module is shared, so another teacher's student is just as good a reason
  -- to refuse. The RLS on `students` would hide them from a plain query, which
  -- is why this function is security definer.
  if exists (select 1 from public.students where current_module_id = module_id) then
    raise exception 'Move the students out of this module first, or deactivate it instead.';
  end if;

  if exists (
    select 1 from public.student_modules sm
    where sm.module_id = delete_module.module_id
  ) then
    raise exception 'Students have history in this module. Deactivate it instead of deleting it.';
  end if;

  update public.lessons
  set module = '',
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(''::text),
        true
      )
  where module = old_name;

  delete from public.modules where id = module_id;
end;
$$;

grant execute on function public.delete_module(uuid) to authenticated;

-- Teachers, listed --------------------------------------------------------------
-- The /teachers page reads `profiles` directly under the policy from 0002
-- (`id = auth.uid() or is_admin()`), which is already exactly right: only an
-- admin can list anyone else. Creating one needs the service_role key, so it
-- goes through the admin-create-teacher Edge Function, like students do.
--
-- To promote an existing account by hand instead:
--   update public.profiles set role = 'teacher' where email = 'them@example.com';
