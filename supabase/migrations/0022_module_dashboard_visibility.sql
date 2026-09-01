-- Which modules the homepage's module gallery shows.
--
-- The gallery used to hide "Onboarding" from a hardcoded list in the client
-- (`UNLISTED_MODULES` in modules-gallery.tsx): one class, taught once, to a
-- student who hasn't started the course — a folder a teacher opens a handful of
-- times a year and scrolls past every other day. That was right about Onboarding
-- and wrong as a mechanism: every other module a school stops teaching needs a
-- deploy to get out of the way.
--
-- So it becomes a column. Separate from `is_active`, which is a different
-- question: an inactive module is one nobody can be enrolled into any more,
-- while this one is only about what clutters the teacher's own front page. A
-- module can be actively taught and still not want a folder on the dashboard.
--
-- Hidden is hidden from the GRID only. Picking the module by name in the Module
-- filter still brings its folder back — that is the one moment anybody is
-- looking for it — and nothing here touches lessons, access or history.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0021.
-- Idempotent — safe to re-run.

-- Added inside the guard rather than as a plain `add column if not exists`,
-- because the seed below must run once and only once: a re-run after a teacher
-- has switched Onboarding back on should not switch it off again.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'modules'
      and column_name = 'show_on_dashboard'
  ) then
    alter table public.modules
      add column show_on_dashboard boolean not null default true;

    -- Carry the old hardcoded rule over, so the gallery looks the same the
    -- moment this runs.
    update public.modules
    set show_on_dashboard = false
    where name = 'Onboarding';
  end if;
end
$$;
