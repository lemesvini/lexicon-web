-- Which days of the week a group meets.
--
-- 0007 gave a group a free-text `schedule`, which was fine for reading and
-- useless for asking questions of — "what am I teaching today?" is not a
-- substring search. This makes the days themselves data, and leaves `schedule`
-- to hold the time (or anything else) alongside them.
--
-- Deliberately NOT a table of class dates. Nothing here materialises a row per
-- session: the days are a recurring pattern the dashboard reads to say what is
-- on today, and attendance stays exactly as it was — one row per student per
-- date, written only when a register is actually taken. A group that skips a
-- week simply has no attendance for it, which is the truth, and no phantom
-- session to clean up afterwards.
--
-- Run this in the Supabase SQL editor after 0007. Idempotent — safe to re-run.

-- 0 = Sunday … 6 = Saturday, matching JavaScript's `Date.getDay()`, which is what
-- reads this column. Postgres's own `extract(dow …)` uses the same numbering, so
-- the two agree if this is ever queried in SQL.
--
-- Empty (the default) means "no fixed days" — a perfectly good state for a group
-- that meets ad hoc, and the one every group created before this migration is
-- in. Not null, so the array is always something to iterate rather than a null
-- to guard.
alter table public.groups
  add column if not exists meets_on smallint[] not null default '{}';

-- `<@` is "contained by": every element must be one of the seven, which also
-- admits the empty array. Rebuilt rather than altered — Postgres has no ALTER
-- CONSTRAINT for a CHECK.
alter table public.groups drop constraint if exists groups_meets_on_check;
alter table public.groups
  add constraint groups_meets_on_check
  check (meets_on <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

comment on column public.groups.meets_on is
  'Days of the week the group meets, 0 = Sunday … 6 = Saturday. Empty for no fixed schedule.';

comment on column public.groups.schedule is
  'Free text alongside meets_on — normally the time, e.g. "19:00".';
