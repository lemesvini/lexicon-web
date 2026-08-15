-- Homework the student answers, and the teacher corrects.
--
-- 0004 made homework something to read. This makes it something to do: three
-- exercise blocks (two objective, one written), one submission per student per
-- homework, and a correction pass that ends in a mark out of ten.
--
--   homework_submissions   one row per student per homework
--   student_submissions    the view the student reads their own row through
--
-- Three rules shape all of it:
--
--   1. The answer key never travels with the question. The right answer lives in
--      `homework.document` where the teacher authored it, and `student_homework`
--      strips it on the way out. A student who reads the network gets four
--      options and no hint.
--
--   2. A student never writes to the submissions table. RLS is row-level, so a
--      write policy generous enough to let them save an answer would also let
--      them set their own score. Their two writes go through security definer
--      functions that touch only the columns they own.
--
--   3. What they were graded against is snapshotted, not looked up. Editing a
--      homework after it has been handed in must not retroactively change what
--      anyone's answers are compared to.
--
-- Run this in the Supabase SQL editor after 0004. Idempotent — safe to re-run.

-- Answer keys ------------------------------------------------------------------
-- The sibling of strip_teacher_content from 0004, and applied in the same
-- spirit — except this one runs on READ, not on write. The teacher needs the key
-- in the table; only the student's copy has to lose it.

create or replace function public.strip_answer_keys(doc jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    coalesce(doc, '{}'::jsonb),
    '{slides}',
    coalesce(
      (
        select jsonb_agg(
          s.slide
          || jsonb_build_object(
               'blocks',
               coalesce(
                 (
                   select jsonb_agg((b.block - 'answer') order by b.ord)
                   from jsonb_array_elements(
                     coalesce(s.slide -> 'blocks', '[]'::jsonb)
                   ) with ordinality as b(block, ord)
                 ),
                 '[]'::jsonb
               )
             )
          order by s.ord
        )
        from jsonb_array_elements(
          coalesce(doc -> 'slides', '[]'::jsonb)
        ) with ordinality as s(slide, ord)
      ),
      '[]'::jsonb
    ),
    true
  );
$$;

-- Every objective block's right answer, keyed by block id. Blocks without an
-- `answer` (the long-answer question) are absent, which is what makes them
-- unmarkable and therefore the teacher's job.
create or replace function public.homework_answer_key(p_homework_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(b.block ->> 'id', b.block -> 'answer'), '{}'::jsonb)
  from public.homework h,
       lateral jsonb_array_elements(coalesce(h.document -> 'slides', '[]'::jsonb)) as slide,
       lateral jsonb_array_elements(coalesce(slide -> 'blocks', '[]'::jsonb)) as b(block)
  where h.id = p_homework_id
    and b.block ? 'id'
    and b.block ? 'answer';
$$;

-- Which of the student's answers matched. Unanswered reads as wrong rather than
-- as null, so the shape is a plain boolean map the UI can trust.
create or replace function public.mark_answers(p_key jsonb, p_answers jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      e.k,
      to_jsonb(coalesce((coalesce(p_answers, '{}'::jsonb) -> e.k) = e.v, false))
    ),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(p_key, '{}'::jsonb)) as e(k, v);
$$;

-- Re-cut the student's homework view so the key never reaches them ------------

drop view if exists public.student_homework;
create view public.student_homework as
  select
    h.id,
    h.title,
    h.lesson_id,
    l.title as lesson_title,
    l.module,
    public.strip_answer_keys(h.document) as document,
    h.updated_at
  from public.homework h
  join public.lessons l on l.id = h.lesson_id
  where h.status = 'published'
    and (public.is_admin() or l.module = public.current_student_module_name());

revoke all on public.student_homework from anon, authenticated;
grant select on public.student_homework to authenticated;

-- Who is asking ----------------------------------------------------------------
-- The roster id of the calling student. security definer for the same reason as
-- everything else here: it is used inside policies on `students` itself.

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.students
  where user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

grant execute on function public.current_student_id() to authenticated;

-- Submissions ------------------------------------------------------------------
--
--   in_progress  answers are being saved as they go; still editable
--   submitted    handed in and locked; waiting on the teacher
--   graded       marked, and the feedback is released to the student
--
-- `answers`, `answer_key`, `marks` and `block_notes` are all maps keyed by block
-- id — which is why the three exercise blocks carry a stable `id` in the
-- document (see src/lib/lessons.ts). Keying by position instead would scramble
-- every answer already given the first time a question is reordered.

create table if not exists public.homework_submissions (
  id           uuid primary key default gen_random_uuid(),
  homework_id  text not null references public.homework (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,

  -- { blockId: number | string }
  answers      jsonb not null default '{}'::jsonb,

  status       text not null default 'in_progress'
                 check (status in ('in_progress', 'submitted', 'graded')),

  -- Snapshotted at hand-in: what the objective answers were at that moment, and
  -- which the student got. Editing the homework afterwards leaves these alone.
  answer_key   jsonb not null default '{}'::jsonb,
  marks        jsonb not null default '{}'::jsonb,

  score        numeric(4, 2) check (score is null or (score >= 0 and score <= 10)),
  feedback     text,
  -- { blockId: text } — the teacher's note on one question.
  block_notes  jsonb not null default '{}'::jsonb,

  submitted_at timestamptz,
  graded_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (homework_id, student_id)
);

create index if not exists homework_submissions_student_idx
  on public.homework_submissions (student_id);
create index if not exists homework_submissions_status_idx
  on public.homework_submissions (status, submitted_at);

drop trigger if exists homework_submissions_set_updated_at on public.homework_submissions;
create trigger homework_submissions_set_updated_at
  before update on public.homework_submissions
  for each row
  execute function public.set_updated_at();

-- Admin-only, like every other table here. The student's reads go through the
-- view below and their writes through the two functions after it.
alter table public.homework_submissions enable row level security;

drop policy if exists "homework_submissions_admin" on public.homework_submissions;
create policy "homework_submissions_admin"
  on public.homework_submissions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The student's own submission -------------------------------------------------
-- Everything the correction produces is withheld until it is finished. Marks in
-- particular: releasing them at hand-in would tell the student which questions
-- they got wrong while the teacher is still looking at the written answer.

drop view if exists public.student_submissions;
create view public.student_submissions as
  select
    s.id,
    s.homework_id,
    s.answers,
    s.status,
    case when s.status = 'graded' then s.marks else '{}'::jsonb end as marks,
    case when s.status = 'graded' then s.answer_key else '{}'::jsonb end as answer_key,
    case when s.status = 'graded' then s.score end as score,
    case when s.status = 'graded' then s.feedback end as feedback,
    case when s.status = 'graded' then s.block_notes else '{}'::jsonb end as block_notes,
    s.submitted_at,
    s.graded_at
  from public.homework_submissions s
  where s.student_id = public.current_student_id();

revoke all on public.student_submissions from anon, authenticated;
grant select on public.student_submissions to authenticated;

-- The student's two writes -----------------------------------------------------

-- Saves work in progress. Refuses once the homework has been handed in, so a
-- stale tab cannot quietly rewrite an answer the teacher is already marking.
create or replace function public.save_homework_answers(
  p_homework_id text,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_status text;
begin
  v_student := public.current_student_id();
  if v_student is null then
    raise exception 'Only an active student can answer homework.' using errcode = '42501';
  end if;

  -- Reachability is checked by asking the student's own view, so the rule about
  -- what a student may open lives in exactly one place.
  if not exists (select 1 from public.student_homework where id = p_homework_id) then
    raise exception 'That homework is not available to you.' using errcode = '42501';
  end if;

  select status into v_status
  from public.homework_submissions
  where homework_id = p_homework_id and student_id = v_student;

  if v_status is not null and v_status <> 'in_progress' then
    raise exception 'This homework has already been handed in.';
  end if;

  insert into public.homework_submissions (homework_id, student_id, answers)
  values (p_homework_id, v_student, coalesce(p_answers, '{}'::jsonb))
  on conflict (homework_id, student_id)
  do update set answers = excluded.answers;
end;
$$;

grant execute on function public.save_homework_answers(text, jsonb) to authenticated;

-- Hands it in: locks the answers, and snapshots the key and the marking.
create or replace function public.submit_homework(
  p_homework_id text,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_status text;
  v_key jsonb;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  v_student := public.current_student_id();
  if v_student is null then
    raise exception 'Only an active student can answer homework.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.student_homework where id = p_homework_id) then
    raise exception 'That homework is not available to you.' using errcode = '42501';
  end if;

  select status into v_status
  from public.homework_submissions
  where homework_id = p_homework_id and student_id = v_student;

  if v_status is not null and v_status <> 'in_progress' then
    raise exception 'This homework has already been handed in.';
  end if;

  v_key := public.homework_answer_key(p_homework_id);

  insert into public.homework_submissions (
    homework_id, student_id, answers, status, submitted_at, answer_key, marks
  )
  values (
    p_homework_id, v_student, v_answers, 'submitted', now(), v_key,
    public.mark_answers(v_key, v_answers)
  )
  on conflict (homework_id, student_id)
  do update set
    answers      = excluded.answers,
    status       = 'submitted',
    submitted_at = now(),
    answer_key   = excluded.answer_key,
    marks        = excluded.marks;
end;
$$;

grant execute on function public.submit_homework(text, jsonb) to authenticated;

-- Grading is left as a plain table write under the admin policy above: an admin
-- is trusted with every column, so there is nothing for a function to protect.
