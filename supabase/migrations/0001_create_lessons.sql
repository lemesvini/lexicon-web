-- lessons: cloud store for authored lesson documents.
--
-- The Studio's "Save to cloud" button upserts the full `Lesson` document
-- (see src/lib/lessons.ts) into this table, keyed by the lesson's own slug id
-- (e.g. "situation-one"). A few top-level fields are denormalized into columns
-- so a library/list view can query them without parsing every JSON blob; the
-- authoritative copy is always `document`.
--
-- Run this in the Supabase SQL editor (or via `supabase db push` if you adopt
-- the CLI). It is idempotent — safe to re-run.

create table if not exists public.lessons (
  id          text primary key,
  title       text not null default '',
  unit        text not null default '',
  module      text not null default '',
  document    jsonb not null,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep `updated_at` fresh on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row
  execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
-- Any signed-in teacher can read every lesson (shared library), but a lesson
-- can only be created/edited/deleted by whoever first saved it. Because saving
-- upserts on `id`, this also stops one teacher from overwriting another's
-- lesson that happens to share a slug.

alter table public.lessons enable row level security;

drop policy if exists "lessons_select_authenticated" on public.lessons;
create policy "lessons_select_authenticated"
  on public.lessons
  for select
  to authenticated
  using (true);

drop policy if exists "lessons_insert_own" on public.lessons;
create policy "lessons_insert_own"
  on public.lessons
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "lessons_update_own" on public.lessons;
create policy "lessons_update_own"
  on public.lessons
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "lessons_delete_own" on public.lessons;
create policy "lessons_delete_own"
  on public.lessons
  for delete
  to authenticated
  using (created_by = auth.uid());
