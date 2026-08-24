-- Profile pictures for students.
--
-- Three pieces: a column to hold the object path, a Storage bucket to hold the
-- file, and one function that lets a student change their own — which is the
-- only part that needs thought.
--
-- A student can read their own `students` row (0006's
-- `students_select_own_or_teacher`) but cannot write it: `students_write_own`
-- is staff-only, and deliberately so — that row carries their module, their
-- teacher and their fee, none of which they may set. RLS is row-level, so
-- there is no policy that would open one column of it and keep the rest shut.
-- Hence `set_own_avatar`: a security definer function is the column-level grant
-- Postgres won't otherwise give, and it writes exactly one field of exactly one
-- row.
--
-- The file itself lives under `{student_id}/…` in a public bucket, and the
-- folder is the authorisation: `can_write_student_avatar()` says who may put
-- something there. Public read is a real decision — an avatar is shown beside a
-- name on a roster the whole staff can see, and signing every one of those URLs
-- buys nothing when the object path is a uuid nobody can guess.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0008.
-- Idempotent — safe to re-run.

-- The column ------------------------------------------------------------------
-- The Storage object *path*, not a URL — same rule as lesson images (see
-- src/lib/storage.ts): the public base URL is derived at render time, so moving
-- the project doesn't invalidate every row.

alter table public.students
  add column if not exists avatar_path text;

-- A student setting their own -------------------------------------------------

create or replace function public.set_own_avatar(path text)
returns void
language plpgsql
security definer
-- Pinned: a security definer function runs as its owner, and an attacker-set
-- search_path is how that privilege gets borrowed.
set search_path = public, pg_temp
as $$
begin
  update public.students
     set avatar_path = nullif(trim(coalesce(path, '')), '')
   where user_id = auth.uid();

  -- No row is not "nothing to do" — it means a signed-in account with no roster
  -- row tried to write one, and silence would look like success.
  if not found then
    raise exception 'No student row for the current user.';
  end if;
end;
$$;

revoke all on function public.set_own_avatar(text) from public;
grant execute on function public.set_own_avatar(text) to authenticated;

-- The bucket ------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('student-avatars', 'student-avatars', true)
on conflict (id) do update set public = true;

/**
 * May the caller write to this student's avatar folder?
 *
 * Two ways in, mirroring who may change the picture at all: the student
 * themselves, or the staff member whose roster they are on. `owns_student()`
 * (0006) is already the second of those and covers the admin.
 *
 * Security definer for the same reason `owns_student` is — it reads `students`,
 * and must not re-enter that table's own policies from inside one.
 *
 * The null guard is load-bearing. A malformed object name has no student id to
 * authorise against, and `owns_student(null)` is *true* for an admin — it
 * answers `is_admin() or …` before it ever looks at the row. Without this, an
 * admin could write to a path outside any student's folder, which is exactly
 * the case the folder convention exists to rule out.
 */
create or replace function public.can_write_student_avatar(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select student is not null
     and (
       exists (
         select 1
           from public.students s
          where s.id = student
            and s.user_id = auth.uid()
       )
       or public.owns_student(student)
     );
$$;

revoke all on function public.can_write_student_avatar(uuid) from public;
grant execute on function public.can_write_student_avatar(uuid) to authenticated;

-- Storage policies -------------------------------------------------------------
-- The first path segment is the student's id, and it is what every check below
-- turns on. A malformed name — no folder, or a folder that isn't a uuid — has no
-- student to authorise against, so the cast is guarded rather than left to
-- throw inside a policy.

create or replace function public.avatar_folder_student(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(object_name))[1] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

grant execute on function public.avatar_folder_student(text) to authenticated;

drop policy if exists "student_avatars_read" on storage.objects;
create policy "student_avatars_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'student-avatars');

drop policy if exists "student_avatars_insert" on storage.objects;
create policy "student_avatars_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'student-avatars'
    and public.can_write_student_avatar(public.avatar_folder_student(name))
  );

drop policy if exists "student_avatars_update" on storage.objects;
create policy "student_avatars_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'student-avatars'
    and public.can_write_student_avatar(public.avatar_folder_student(name))
  )
  with check (
    bucket_id = 'student-avatars'
    and public.can_write_student_avatar(public.avatar_folder_student(name))
  );

-- Replacing a picture leaves the old object behind; this is what lets the app
-- sweep it up rather than accumulating every avatar a student has ever had.
drop policy if exists "student_avatars_delete" on storage.objects;
create policy "student_avatars_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'student-avatars'
    and public.can_write_student_avatar(public.avatar_folder_student(name))
  );
