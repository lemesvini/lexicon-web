-- The register decides what was taught; the plan's dates follow it.
--
-- Until now a group's plan was a calendar: every copy in `group_lessons` carried
-- a fixed `scheduled_on`, the register read "what is today's lesson" off that
-- date, and when a class didn't happen the only remedy was a "push back a class"
-- button that rewrote every later date once. Forget to take a register, press it
-- on the wrong day, or have one student miss a class, and the module's dates
-- were wrong with nothing in the app to put them right.
--
-- The model now, as attendance systems and a paper class diary both keep it:
--
--   * The plan is a SEQUENCE (`group_lessons.position`). The next lesson is the
--     first one in it that no register has recorded as taught.
--   * A lesson is taught on the first day a register records it with at least
--     one student present. Nobody present means the class didn't happen, and
--     the lesson simply stays next — there is nothing to push.
--   * The dates in `scheduled_on` are a projection: taught lessons carry the day
--     they were taught, the rest are laid on the group's coming meeting days.
--     The app recomputes them after every register write (see `reflowPlan` in
--     src/features/groups/data/class-plan.ts), so they can always be fixed by
--     fixing the register.
--
-- What this migration adds is the two facts the register couldn't record:
--
--   group_attendance.excused   an absence with a reason. Still an absence —
--                              `present` stays false, so every existing reader
--                              keeps counting it as one — but kept apart so it
--                              can be left out of the student's rate.
--   group_cancelled_classes    a meeting day with no class (a holiday, the
--                              teacher off sick). The projection skips it and
--                              it stops showing up as a register to take.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0024.
-- Idempotent — safe to re-run.

alter table public.group_attendance
  add column if not exists excused boolean not null default false;

create table if not exists public.group_cancelled_classes (
  group_id     uuid not null references public.groups (id) on delete cascade,
  class_date   date not null,
  note         text,
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (group_id, class_date)
);

alter table public.group_cancelled_classes enable row level security;

-- The same predicate as the register it sits beside (0007).
drop policy if exists "group_cancelled_classes_own" on public.group_cancelled_classes;
create policy "group_cancelled_classes_own"
  on public.group_cancelled_classes
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id));

grant select, insert, update, delete on public.group_cancelled_classes to authenticated;
