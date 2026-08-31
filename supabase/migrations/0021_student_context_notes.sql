-- A student adding to their own context.
--
-- 0012 let a student write their context exactly once, at onboarding. But the
-- answers go stale: the job changes, the exam gets a date, the reason for
-- studying turns into a different reason. Until now the only way to say so was
-- to tell the teacher and hope it got typed in.
--
-- Same trick as `save_student_onboarding` and 0009's `set_own_avatar`: a
-- security definer function is the column-level grant Postgres won't otherwise
-- give. `students_write_admin` stays staff-only — that row carries their module,
-- teacher and fee — and this writes one field of one row, appending only.
--
-- APPEND-ONLY, deliberately. A student can add to their context and cannot edit
-- or delete any of it, their own blocks included. The column is shared with the
-- teacher's notes about them (see student-notes-card), so a function that could
-- rewrite it would be a function that could erase those; and a context is a
-- record of what was true when it was said, which is why each block is dated.
--
-- The block is written in the same shape `buildOnboardingSummary` uses — a
-- `--- heading ---`, then Q:/A: — so the teacher reading the context tile sees
-- one kind of thing, and the student's own page (which lists only these blocks,
-- never the teacher's prose) needs no second parser.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0020.
-- Idempotent — safe to re-run.

create or replace function public.add_student_context_note(
  note_title text,
  note_body text
)
returns void
language plpgsql
security definer
-- Pinned: a security definer function runs as its owner, and an attacker-set
-- search_path is how that privilege gets borrowed.
set search_path = public, pg_temp
as $$
declare
  clean_title text := nullif(trim(coalesce(note_title, '')), '');
  clean_body  text := nullif(trim(coalesce(note_body, '')), '');
  block       text;
begin
  if clean_title is null or clean_body is null then
    raise exception 'A note needs both a title and something in it.';
  end if;

  -- Caps rather than a constraint on the column: the field is free text a
  -- teacher also writes into, and the limit being argued for here is only about
  -- what one submission from a form may add.
  if length(clean_title) > 120 then
    raise exception 'Note title is too long (max 120 characters).';
  end if;

  if length(clean_body) > 2000 then
    raise exception 'Note is too long (max 2000 characters).';
  end if;

  -- Dated, and marked as the student's own: a teacher reading the context tile
  -- should be able to tell who said a thing without asking.
  block := '--- ' || clean_title || ' (aluno, '
           || to_char(now() at time zone 'utc', 'YYYY-MM-DD') || ') ---'
           || E'\n\n' || 'Q: ' || clean_title
           || E'\n' || 'A: ' || clean_body;

  update public.students
     set notes = case
                   when coalesce(trim(notes), '') = '' then block
                   else notes || E'\n\n' || block
                 end,
         updated_at = now()
   where user_id = auth.uid();

  -- No row means an account with no roster row at all — a stray sign-up, or a
  -- deactivated student. Silence would look like success.
  if not found then
    raise exception 'No student row for the current user.';
  end if;
end;
$$;

revoke all on function public.add_student_context_note(text, text) from public;
grant execute on function public.add_student_context_note(text, text) to authenticated;
