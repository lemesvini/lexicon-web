-- Student access: roles, modules, students, and the RLS that isolates them.
--
-- Until now every signed-in user was implicitly a teacher. This migration adds
-- a second kind of user — the student — who signs in to the same app with their
-- own email, and can only see the one module an admin has assigned them.
--
--   profiles         one row per auth user, carrying the admin/student role
--   modules          the curriculum, so modules can be renamed without a deploy
--   students         the roster: who they are, their status, their module
--   student_modules  history of the modules a student has been through
--
-- Accounts are created by an admin through the `admin-create-student` Edge
-- Function (which holds the service_role key), not by public signup — see
-- supabase/functions/admin-create-student/index.ts.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`). It is
-- idempotent — safe to re-run.
--
-- IMPORTANT, do both of these once after running this file:
--   1. Check the backfill at the bottom promoted your teacher account(s) to
--      'admin'. Without it the app locks every existing user out of /students.
--   2. In Authentication > Sign In / Providers, turn OFF "Allow new users to
--      sign up". The app never calls signUp, but the endpoint is public by
--      default, and this migration is written so that anyone who slipped
--      through would land as a role-less student with no roster row anyway.

-- Profiles --------------------------------------------------------------------
-- The source of truth for a user's role. Kept separate from `students` because
-- admins need a role too, and a student's roster row may exist before (or
-- outlive) their auth account.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  full_name   text,
  role        text not null default 'student' check (role in ('admin', 'student')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Every new auth user gets a profile, always as 'student'.
--
-- The role is deliberately NOT read from raw_user_meta_data: sign-up metadata is
-- attacker-controlled, so trusting it would let anyone who can reach the public
-- /auth/v1/signup endpoint mint themselves an admin. Admins are promoted by hand
-- (see the backfill at the bottom of this file).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Is the caller an admin?
--
-- security definer is load-bearing: this runs inside the RLS policies on
-- `profiles` itself, so a plain query here would re-enter those policies and
-- recurse. Running as the owner skips RLS and breaks the cycle.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Modules ---------------------------------------------------------------------
-- The curriculum as data. `lessons.module` stays a free-text column (the Studio
-- writes it as part of the lesson document); this table is what a student's
-- access is pinned to, matched by name.

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Seed from whatever modules the existing lesson library already uses, so the
-- roster's module picker isn't empty on day one.
insert into public.modules (name)
select distinct trim(module)
from public.lessons
where trim(coalesce(module, '')) <> ''
on conflict (name) do nothing;

-- Students --------------------------------------------------------------------

create table if not exists public.students (
  id                 uuid primary key default gen_random_uuid(),
  -- Null while the roster row exists without an auth account, and on delete set
  -- null so removing an account keeps the student's history.
  user_id            uuid unique references auth.users (id) on delete set null,
  full_name          text not null,
  email              text not null unique,
  phone              text,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  current_module_id  uuid references public.modules (id) on delete set null,
  notes              text,
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists students_email_idx on public.students (email);
create index if not exists students_current_module_idx on public.students (current_module_id);

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row
  execute function public.set_updated_at();

-- Which modules a student has been through. The current one is also on
-- `students.current_module_id`; this table is the trail behind it.
create table if not exists public.student_modules (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  module_id     uuid not null references public.modules (id) on delete cascade,
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (student_id, module_id)
);

create index if not exists student_modules_student_idx on public.student_modules (student_id);

-- The name of the module the calling student is currently allowed into, or null
-- for admins, inactive students, and anyone without a module. security definer
-- for the same reason as is_admin(): it is used inside the `lessons` policy and
-- must not re-enter the policies on `students`.
create or replace function public.current_student_module_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.name
  from public.students s
  join public.modules m on m.id = s.current_module_id
  where s.user_id = auth.uid()
    and s.status = 'active'
  limit 1;
$$;

grant execute on function public.current_student_module_name() to authenticated;

-- Row Level Security ----------------------------------------------------------
-- The rule everywhere: an admin sees and edits everything; a student sees only
-- their own row and nothing else. Students never get write access to any of
-- these tables — the roster is admin-managed, and account creation goes through
-- the Edge Function.

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.students enable row level security;
alter table public.student_modules enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- modules: everyone signed in can read the names (a student's page shows theirs),
-- only admins can change the curriculum.
drop policy if exists "modules_select_authenticated" on public.modules;
create policy "modules_select_authenticated"
  on public.modules
  for select
  to authenticated
  using (true);

drop policy if exists "modules_write_admin" on public.modules;
create policy "modules_write_admin"
  on public.modules
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- students
drop policy if exists "students_select_own_or_admin" on public.students;
create policy "students_select_own_or_admin"
  on public.students
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "students_write_admin" on public.students;
create policy "students_write_admin"
  on public.students
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- student_modules
drop policy if exists "student_modules_select_own_or_admin" on public.student_modules;
create policy "student_modules_select_own_or_admin"
  on public.student_modules
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_modules.student_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "student_modules_write_admin" on public.student_modules;
create policy "student_modules_write_admin"
  on public.student_modules
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lessons: narrow the library to the student's module --------------------------
-- 0001 let any authenticated user read every lesson, which was right when every
-- user was a teacher. Now that students sign in to the same project, that policy
-- would hand them the whole curriculum, so it is replaced: admins still read
-- everything, a student reads only lessons tagged with their current module.
-- (A student with no module matches nothing, since `module = null` is null.)

drop policy if exists "lessons_select_authenticated" on public.lessons;
drop policy if exists "lessons_select_admin_or_own_module" on public.lessons;
create policy "lessons_select_admin_or_own_module"
  on public.lessons
  for select
  to authenticated
  using (
    public.is_admin()
    or module = public.current_student_module_name()
  );

-- The insert/update/delete policies from 0001 stay as they are: they are already
-- scoped to `created_by = auth.uid()`, and a student never owns a lesson.

-- Backfill --------------------------------------------------------------------
-- Everyone who existed before this migration is a teacher, so give them an admin
-- profile. Runs last so the tables and trigger are already in place.
--
-- To promote someone later:
--   update public.profiles set role = 'admin' where email = 'them@example.com';

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  'admin'
from auth.users u
on conflict (id) do nothing;
