-- Push notifications for the mobile app.
--
-- Three things reach a student's phone:
--
--   homework_graded   the teacher corrected a homework and released the mark
--   unit_report       the teacher wrote the report of a unit
--   class_reminder    their group's class starts within the hour
--
-- (The daily nudge to practise is not here: the app schedules it on the phone
-- itself, since it depends on nothing the server knows.)
--
-- Every notification is first a row in `notifications`, which is both the
-- outbox and the student's inbox — the bell on the Today tab lists it. Rows are
-- written by triggers (the teacher's two saves) and by a pg_cron job (the class
-- reminders), never by the browser: the teacher panel writes its corrections
-- straight to the tables, and has no key that could send a push.
--
-- Delivery is the `send-push` Edge Function (supabase/functions/send-push). An
-- insert into `notifications` calls it through pg_net, after the transaction
-- commits; the cron job calls it again for anything that failed. The function
-- claims a batch with `claim_push_batch`, sends it through Expo's push service
-- and settles it with `settle_push_batch`.
--
--   push_tokens                 one row per device the student is signed in on
--   notification_preferences    what the student turned off (only class reminders,
--                               for now — a correction is always worth knowing)
--   student_notifications       the student's inbox, as a view
--
-- Before running: enable `pg_cron` and `pg_net` (Database → Extensions). After
-- running, the function needs two Vault secrets to be callable from here — see
-- the end of this file — and `supabase functions deploy send-push`.
--
-- Times: `groups.starts_at` is in the school's local time (0019) and has no zone
-- of its own. The school is in São Paulo, so that is the zone a class starts in.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0035.
-- Idempotent — safe to re-run.

-- Devices ----------------------------------------------------------------------
-- Keyed by the Expo push token, not by the user: a token is one install of the
-- app, and when somebody else signs in on that phone it moves to them rather
-- than being delivered to both.

create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- No policies: the app writes through the two functions below, and only the
-- Edge Function (service_role) reads.
revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Not an Expo push token.';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Called on sign-out, while the session is still good. Only ever the caller's
-- own token: knowing somebody's token is not a reason to switch them off.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens
  where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Preferences --------------------------------------------------------------------
-- A missing row is the defaults, so nobody has to be backfilled.

create table if not exists public.notification_preferences (
  student_id       uuid primary key references public.students (id) on delete cascade,
  class_reminders  boolean not null default true,
  updated_at       timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant all on public.notification_preferences to service_role;

drop view if exists public.student_notification_preferences;
create view public.student_notification_preferences as
  select coalesce(p.class_reminders, true) as class_reminders
  from (select public.current_student_id() as id) me
  left join public.notification_preferences p on p.student_id = me.id
  where me.id is not null;

revoke all on public.student_notification_preferences from anon, authenticated;
grant select on public.student_notification_preferences to authenticated;

create or replace function public.set_class_reminders(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := public.current_student_id();
begin
  if v_student is null then
    raise exception 'Not a student.';
  end if;

  insert into public.notification_preferences (student_id, class_reminders)
  values (v_student, p_enabled)
  on conflict (student_id) do update
    set class_reminders = excluded.class_reminders,
        updated_at = now();
end;
$$;

revoke all on function public.set_class_reminders(boolean) from public, anon;
grant execute on function public.set_class_reminders(boolean) to authenticated;

-- Notifications ------------------------------------------------------------------
--
--   url          the app route the notification opens — "/assignment/<id>"
--   dedupe_key   what makes it the same notification twice: the cron job and
--                the triggers insert with `on conflict do nothing` on it
--   claimed_at   set while `send-push` has it in hand; a claim older than five
--                minutes is taken to have died with its function
--   sent_at      handed to Expo (or there was no device to hand it to)

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  kind         text not null
                 check (kind in ('homework_graded', 'unit_report', 'class_reminder')),
  title        text not null,
  body         text not null,
  url          text,
  dedupe_key   text not null unique,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  claimed_at   timestamptz,
  sent_at      timestamptz,
  attempts     smallint not null default 0,
  last_error   text
);

create index if not exists notifications_student_idx
  on public.notifications (student_id, created_at desc);
create index if not exists notifications_pending_idx
  on public.notifications (created_at) where sent_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;

-- The inbox. Two months is plenty to scroll back through.
drop view if exists public.student_notifications;
create view public.student_notifications as
  select n.id, n.kind, n.title, n.body, n.url, n.created_at, n.read_at
  from public.notifications n
  where n.student_id = public.current_student_id()
    and n.created_at > now() - interval '60 days';

revoke all on public.student_notifications from anon, authenticated;
grant select on public.student_notifications to authenticated;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where student_id = public.current_student_id()
    and read_at is null;
$$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Helpers ------------------------------------------------------------------------

/** 8.50 → "8,5", 10.00 → "10": how the app writes a mark. */
create or replace function public.format_score(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when round(p_score, 1) = trunc(p_score) then trunc(p_score)::text
    else replace(round(p_score, 1)::text, '.', ',')
  end;
$$;

/** "[Lesson Eight: Conversation] At the airport" → "At the airport". */
create or replace function public.plain_lesson_title(p_title text)
returns text
language sql
immutable
as $$
  select nullif(trim(regexp_replace(coalesce(p_title, ''), '^\s*\[[^\]]*\]\s*', '')), '');
$$;

-- Delivery -------------------------------------------------------------------------
-- Calls `send-push` through pg_net. The request is queued with the transaction
-- and goes out after it commits, so a rolled-back save sends nothing.
--
-- Never raises: this runs inside the teacher's save, and a missing secret or a
-- pg_net hiccup must not stop a correction from being saved. The cron job picks
-- up whatever is left behind.

create or replace function public.dispatch_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_dispatch_secret';

  if v_url is null or v_secret is null then
    raise warning 'dispatch_push: the Vault secrets project_url / push_dispatch_secret are not set';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'dispatch_push: %', sqlerrm;
end;
$$;

revoke all on function public.dispatch_push() from public, anon, authenticated;

create or replace function public.notifications_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_push();
  return null;
end;
$$;

-- Once per statement: the cron job inserts a whole hour's reminders at a time,
-- and one call drains them all.
drop trigger if exists notifications_dispatch on public.notifications;
create trigger notifications_dispatch
  after insert on public.notifications
  for each statement execute function public.notifications_dispatch();

/**
 * Takes up to `p_limit` notifications that are due a send, with the tokens of
 * every device their student is signed in on. Only `send-push` calls this.
 *
 * Anything older than a day is left alone: "your class starts at 19:00" is
 * worse than nothing the next morning.
 */
create or replace function public.claim_push_batch(p_limit int default 200)
returns table (
  id uuid,
  kind text,
  title text,
  body text,
  url text,
  tokens text[]
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select n.id
    from public.notifications n
    where n.sent_at is null
      and n.attempts < 5
      and n.created_at > now() - interval '1 day'
      and (n.claimed_at is null or n.claimed_at < now() - interval '5 minutes')
    order by n.created_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.notifications n
    set claimed_at = now(), attempts = n.attempts + 1
    from due
    where n.id = due.id
    returning n.id, n.student_id, n.kind, n.title, n.body, n.url
  )
  select
    c.id, c.kind, c.title, c.body, c.url,
    coalesce(
      (select array_agg(t.token)
       from public.students s
       join public.push_tokens t on t.user_id = s.user_id
       where s.id = c.student_id),
      '{}'
    )
  from claimed c;
$$;

revoke all on function public.claim_push_batch(int) from public, anon, authenticated;
grant execute on function public.claim_push_batch(int) to service_role;

/**
 * Settles a batch: `p_sent` went out, `p_failed` goes back to wait for the next
 * try (with `p_error` on it), and `p_dead_tokens` are devices Expo says will
 * never receive anything again.
 */
create or replace function public.settle_push_batch(
  p_sent uuid[],
  p_failed uuid[],
  p_error text,
  p_dead_tokens text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set sent_at = now(), claimed_at = null, last_error = null
  where id = any (coalesce(p_sent, '{}'));

  update public.notifications
  set claimed_at = null, last_error = p_error
  where id = any (coalesce(p_failed, '{}'));

  delete from public.push_tokens
  where token = any (coalesce(p_dead_tokens, '{}'));
end;
$$;

revoke all on function public.settle_push_batch(uuid[], uuid[], text, text[])
  from public, anon, authenticated;
grant execute on function public.settle_push_batch(uuid[], uuid[], text, text[])
  to service_role;

-- A homework is corrected -----------------------------------------------------------
-- On the move to 'graded' — which is when `student_submissions` (0005) releases
-- the mark. Saving an already graded correction again (fixing a typo in the
-- feedback) is not news. A homework reopened and corrected again is a second
-- correction, and says so again: `graded_at` is part of the key.

create or replace function public.notify_homework_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if tg_op = 'UPDATE' and old.status = 'graded' then
    return null;
  end if;

  select nullif(trim(h.title), '') into v_title
  from public.homework h where h.id = new.homework_id;

  insert into public.notifications (student_id, kind, title, body, url, dedupe_key)
  values (
    new.student_id,
    'homework_graded',
    'Sua atividade foi corrigida',
    coalesce(v_title, 'Sua atividade')
      || case when new.score is not null
           then ' · nota ' || public.format_score(new.score)
           else ''
         end
      || '. Veja o feedback do professor.',
    '/assignment/' || new.homework_id,
    'graded:' || new.id || ':' || extract(epoch from coalesce(new.graded_at, now()))::bigint
  )
  on conflict (dedupe_key) do nothing;

  return null;
exception when others then
  -- The correction is saved whatever happens to its notification.
  raise warning 'notify_homework_graded: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists homework_submissions_notify_graded on public.homework_submissions;
create trigger homework_submissions_notify_graded
  after insert or update of status on public.homework_submissions
  for each row
  when (new.status = 'graded')
  execute function public.notify_homework_graded();

-- A unit report is written ------------------------------------------------------------
-- The report is upserted on every save (lexicon-web's saveUnitReport), so this
-- says so once: the first time the report has something the student can read.
-- `teacher_notes` doesn't count — the student never sees it (0035).

create or replace function public.notify_unit_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module text;
begin
  if new.observations is null and new.test_score is null then
    return null;
  end if;

  select m.name into v_module from public.modules m where m.id = new.module_id;

  insert into public.notifications (student_id, kind, title, body, url, dedupe_key)
  values (
    new.student_id,
    'unit_report',
    'Novo relatório de unidade',
    concat_ws(' · ', v_module, 'Unit ' || new.unit)
      || case when new.test_score is not null
           then ' · nota ' || public.format_score(new.test_score)
           else ''
         end
      || '. Veja o que seu professor escreveu.',
    '/report/' || new.id,
    'report:' || new.id
  )
  on conflict (dedupe_key) do nothing;

  return null;
exception when others then
  raise warning 'notify_unit_report: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists student_unit_reports_notify on public.student_unit_reports;
create trigger student_unit_reports_notify
  after insert or update of observations, test_score on public.student_unit_reports
  for each row
  execute function public.notify_unit_report();

-- A class is about to start --------------------------------------------------------------
-- The same dates the app shows on the Today tab: the group's plan
-- (`group_lessons.scheduled_on`) at the group's hour (`groups.starts_at`). A
-- group with no dated lesson at all falls back to its meeting days
-- (`groups.meets_on`, 0008). A group with no hour gets no reminder — there is
-- no "starts at" to remind anybody of.
--
-- Anything starting in the next hour that hasn't been reminded yet: a class
-- added to the plan at the last minute is still announced, and a missed run of
-- the job is caught up by the next one.

create or replace function public.enqueue_class_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone constant text := 'America/Sao_Paulo';
  v_today date := (now() at time zone v_zone)::date;
begin
  with planned as (
    select
      g.id as group_id,
      gl.scheduled_on as class_date,
      g.starts_at,
      gl.lesson_id,
      public.plain_lesson_title(l.title) as lesson_title
    from public.groups g
    join public.group_lessons gl on gl.group_id = g.id
    join public.lessons l on l.id = gl.lesson_id
    where g.status = 'active'
      and g.starts_at is not null
      and gl.scheduled_on between v_today and v_today + 1
  ),
  weekly as (
    select
      g.id as group_id,
      d::date as class_date,
      g.starts_at,
      null::text as lesson_id,
      null::text as lesson_title
    from public.groups g
    cross join generate_series(v_today::timestamp, (v_today + 1)::timestamp, interval '1 day') d
    where g.status = 'active'
      and g.starts_at is not null
      and extract(dow from d)::smallint = any (g.meets_on)
      and not exists (
        select 1 from public.group_lessons gl
        where gl.group_id = g.id and gl.scheduled_on is not null
      )
  ),
  classes as (
    select *, ((class_date + starts_at) at time zone v_zone) as starts
    from (select * from planned union all select * from weekly) c
  )
  insert into public.notifications (student_id, kind, title, body, url, dedupe_key)
  select
    s.id,
    'class_reminder',
    'Sua aula começa às ' || left(c.starts_at::text, 5),
    coalesce(c.lesson_title || '. ', '') || 'Toque para revisar antes de entrar.',
    case when c.lesson_id is not null then '/lesson/' || c.lesson_id else '/today' end,
    'class:' || c.group_id || ':' || c.class_date || ':' || s.id
  from classes c
  join public.group_students gs on gs.group_id = c.group_id
  join public.students s on s.id = gs.student_id
  left join public.notification_preferences p on p.student_id = s.id
  where c.starts > now()
    and c.starts <= now() + interval '60 minutes'
    and s.status = 'active'
    and s.user_id is not null
    and coalesce(p.class_reminders, true)
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.enqueue_class_reminders() from public, anon, authenticated;

-- The job ---------------------------------------------------------------------------------
-- Every minute: queue the reminders now due, and retry anything still unsent a
-- minute after it was queued (a new row already called the function itself).

create or replace function public.run_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_class_reminders();

  if exists (
    select 1 from public.notifications
    where sent_at is null
      and attempts < 5
      and created_at < now() - interval '1 minute'
      and created_at > now() - interval '1 day'
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
  ) then
    perform public.dispatch_push();
  end if;
end;
$$;

revoke all on function public.run_notifications() from public, anon, authenticated;

-- Scheduling the same name again replaces the job, so re-running is fine.
select cron.schedule('run-notifications', '* * * * *', 'select public.run_notifications()');

-- Vault secrets (once, by hand — not in this file, because they're secrets) ----------------
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<the same random string as PUSH_DISPATCH_SECRET>',
--                              'push_dispatch_secret');
--
-- and on the function side:
--
--   supabase secrets set PUSH_DISPATCH_SECRET=<that string> EXPO_ACCESS_TOKEN=<token>
