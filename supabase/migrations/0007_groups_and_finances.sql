-- Groups and finances: who is taught together, and what they pay.
--
-- Two small additions to the school side of the app, neither of which touches
-- the curriculum:
--
--   finances  two columns on `students` — what they pay a month, and how many
--             classes a week that buys. Not a table of its own: there is exactly
--             one of each per student, and an invoicing ledger is a much bigger
--             thing than the /finances page is asking for.
--
--   groups    students taught together, the lesson they're on, and who turned up
--             to each class. Three tables:
--               groups            the class itself, and its teacher
--               group_students    who is in it
--               group_attendance  one row per student per class date
--
-- A group belongs to a teacher exactly the way a student does (0006), so the
-- same two predicates carry the RLS here: `is_admin()` sees everything, and a
-- teacher sees the groups they own. `owns_group()` below is the group-shaped
-- twin of `owns_student()`.
--
-- Students get no access to any of this: there is no student-facing UI for a
-- group, and attendance is a staff record. Their own `students` row is the one
-- thing they can already read, so a student can see what they pay — which is
-- true of any invoice, and is the reason the fee lives there rather than
-- somewhere more private.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) after 0006.
-- Idempotent — safe to re-run. No Edge Function changes: nothing here touches an
-- auth account.

-- Finances ---------------------------------------------------------------------
-- Both nullable, and null means "not set yet" rather than zero — a student who
-- hasn't been priced up shouldn't quietly count as free in the revenue total.
--
-- numeric, not float: money that has been through a binary float is money that
-- no longer adds up.

alter table public.students
  add column if not exists monthly_fee numeric(10, 2)
    check (monthly_fee is null or monthly_fee >= 0);

alter table public.students
  add column if not exists classes_per_week smallint
    check (classes_per_week is null or classes_per_week between 0 and 14);

-- Groups -----------------------------------------------------------------------

create table if not exists public.groups (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  -- Who teaches it. `on delete set null` for the same reason as students: a
  -- teacher's departure shouldn't take their groups' history with it.
  teacher_id         uuid references public.profiles (id) on delete set null,
  -- The lesson the group is on right now. `lessons.id` is a text slug, not a
  -- uuid (see 0001).
  current_lesson_id  text references public.lessons (id) on delete set null,
  -- Free text — "Mon/Wed 18:00". A real timetable is a bigger thing than this
  -- page needs, and no two schools write theirs the same way.
  schedule           text,
  status             text not null default 'active'
    check (status in ('active', 'inactive')),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists groups_teacher_idx on public.groups (teacher_id);

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row
  execute function public.set_updated_at();

-- Who is in the group. A student can be in more than one (a group class and a
-- private slot are both groups), so this is a plain join table keyed on the
-- pair. Cascades on both sides: membership is not history worth keeping once
-- either end is gone — the attendance rows below are.
create table if not exists public.group_students (
  group_id    uuid not null references public.groups (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index if not exists group_students_student_idx
  on public.group_students (student_id);

-- One row per student per class date. The unique constraint is what makes
-- ticking a box an upsert rather than an ever-growing pile of duplicates, and it
-- is also the definition of a "class": one per group per day.
create table if not exists public.group_attendance (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  class_date   date not null default current_date,
  present      boolean not null default true,
  -- What was taught that day, snapshotted at the time: the group moves on to the
  -- next lesson, and the record of what this class was should not move with it.
  lesson_id    text references public.lessons (id) on delete set null,
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (group_id, student_id, class_date)
);

create index if not exists group_attendance_group_date_idx
  on public.group_attendance (group_id, class_date desc);

-- Is this group the caller's to see and edit? The group-shaped twin of
-- `owns_student()` (0006), and security definer for the same reason: it reads
-- `groups`, and is used inside policies on tables whose own policies would
-- otherwise re-enter.
create or replace function public.owns_group(p_group_id uuid)
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
        select 1 from public.groups g
        where g.id = p_group_id
          and g.teacher_id = auth.uid()
      )
    );
$$;

grant execute on function public.owns_group(uuid) to authenticated;

-- Row Level Security -----------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_students enable row level security;
alter table public.group_attendance enable row level security;

-- Same shape as the roster: admin sees all, an active teacher sees their own.
-- WITH CHECK carries the weight on writes — a teacher can only create or keep a
-- group whose `teacher_id` is themselves, so there is no way to file a group
-- under someone else or to hand one away.
drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own"
  on public.groups
  for select
  to authenticated
  using (public.is_admin() or (public.is_staff() and teacher_id = auth.uid()));

drop policy if exists "groups_write_own" on public.groups;
create policy "groups_write_own"
  on public.groups
  for all
  to authenticated
  using (public.is_admin() or (public.is_staff() and teacher_id = auth.uid()))
  with check (public.is_admin() or (public.is_staff() and teacher_id = auth.uid()));

-- Membership needs both predicates on insert: your group, and your student. One
-- without the other would let a teacher pull someone else's student onto their
-- own register, which is a read of a name they aren't allowed to see.
drop policy if exists "group_students_own" on public.group_students;
create policy "group_students_own"
  on public.group_students
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id) and public.owns_student(student_id));

drop policy if exists "group_attendance_own" on public.group_attendance;
create policy "group_attendance_own"
  on public.group_attendance
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id) and public.owns_student(student_id));
