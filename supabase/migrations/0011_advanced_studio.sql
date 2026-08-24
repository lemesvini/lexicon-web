-- Per-teacher permission for the advanced context studio (the Claude-assisted
-- editor at /studio/advanced).
--
-- Off by default: it is opt-in, granted by the admin from the teachers list.
-- The admin always has it, flag or not — see `isStaff`'s neighbour in
-- src/lib/profile.ts.
--
-- No new policy is needed: 0006 already lets the admin update any profile row,
-- and everyone can read their own.
--
-- Run this in the Supabase SQL editor after 0010. Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists advanced_studio boolean not null default false;
