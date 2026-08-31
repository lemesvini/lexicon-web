-- The time a group meets, as a time.
--
-- 0008 made the *days* data and left `schedule` as free text holding the hour —
-- "19:00", "7pm", "19h", whatever was typed. That reads fine in a sentence and
-- sorts like nonsense: a week view has to put the 09:00 class above the 19:00
-- one, and no ordering of those strings does that reliably ("7pm" < "19:00").
--
-- So the hour becomes `starts_at time`, which sorts, compares and formats
-- without anyone parsing anything. The old text is carried across where it can
-- be read; the column then goes, because two places to write the same fact is
-- how they end up disagreeing.
--
-- Run this in the Supabase SQL editor after 0018. Idempotent — safe to re-run,
-- and a re-run is a no-op once `schedule` is gone.

alter table public.groups
  add column if not exists starts_at time;

comment on column public.groups.starts_at is
  'The time the group''s class starts, in the school''s local time. Null for a group with no fixed hour.';

-- Backfill, only while the old column is still there. Anything with an hour and
-- minutes in it is read — "19:00", "7:30pm" (as 07:30, which is why the result
-- is worth a look), "19h00". Everything else is left null rather than guessed
-- at; there are few enough groups to fix by hand, which is the deal here.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'groups'
      and column_name = 'schedule'
  ) then
    execute $backfill$
      update public.groups as g
      set starts_at = make_time(parsed.hour, parsed.minute, 0)
      from (
        select
          id,
          (regexp_match(schedule, '(\d{1,2})\s*[:h]\s*(\d{2})'))[1]::int as hour,
          (regexp_match(schedule, '(\d{1,2})\s*[:h]\s*(\d{2})'))[2]::int as minute
        from public.groups
        where schedule is not null
          and schedule ~ '(\d{1,2})\s*[:h]\s*(\d{2})'
      ) as parsed
      where parsed.id = g.id
        and g.starts_at is null
        and parsed.hour between 0 and 23
        and parsed.minute between 0 and 59
    $backfill$;
  end if;
end
$$;

alter table public.groups drop column if exists schedule;
