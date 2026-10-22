-- Listening practice: a sentence heard, put back together from its words.
--
-- The second skill on 0031's tables. A listening activity is a deck of
-- sentences, each with its audio:
--
--   { "voiceId"?, "cards": [{ "id", "text", "translation"?, "lessonId"?,
--                              "audioPath"?, "audioText"?, "voiceId"?,
--                              "distractors"? }] }
--
--   text         the sentence, in English — what is heard and rebuilt
--   translation  in Portuguese, shown once it has been answered
--   audioPath    the sentence spoken, in the `practice-audio` bucket below
--   audioText    the text the audio was made from — when it no longer matches
--                `text`, the Studio knows the audio is out of date
--   voiceId      the ElevenLabs voice it was made with; the activity's
--                `voiceId` is the default for new cards
--   distractors  words that are not in the sentence, offered among its own.
--                Optional: the app borrows some from the other sentences
--
-- The audio is made in the Studio, by the `practice-audio` Edge Function, with
-- ElevenLabs, and stored here; the app only plays it. A card without audio is
-- saved but never reaches a student.
--
-- `student_practice_cards` gains `content`, the whole card, as its LAST column
-- (`create or replace view` only adds at the end); speaking still reads
-- `prompt` / `answer` / `example` as before. Which cards are complete enough to
-- show is now decided per skill.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0031, then deploy
-- the `practice-audio` function (see supabase/functions/practice-audio).
-- Idempotent — safe to re-run.

-- The audio --------------------------------------------------------------------
-- Public read, staff-only write — lesson-embeds' rule (0023). The sentences are
-- as public as the lessons they come from; making them is authoring.

insert into storage.buckets (id, name, public)
values ('practice-audio', 'practice-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "practice_audio_read" on storage.objects;
create policy "practice_audio_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'practice-audio');

drop policy if exists "practice_audio_insert" on storage.objects;
create policy "practice_audio_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'practice-audio' and public.is_staff());

drop policy if exists "practice_audio_update" on storage.objects;
create policy "practice_audio_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'practice-audio' and public.is_staff())
  with check (bucket_id = 'practice-audio' and public.is_staff());

-- A sentence re-recorded leaves its old file behind; this lets it be removed.
drop policy if exists "practice_audio_delete" on storage.objects;
create policy "practice_audio_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'practice-audio' and public.is_staff());

-- The student's cards ----------------------------------------------------------
-- As in 0031, plus `content`, and with what makes a card complete by skill:
--
--   speaking   both sides: `prompt` and `answer`
--   listening  the sentence and its audio: `text` and `audioPath`
--
-- A skill with no player yet shows nothing.

create or replace view public.student_practice_cards as
  select
    a.id as activity_id,
    a.title as activity_title,
    a.skill,
    m.name as module,
    a.position,
    c.ord::integer as card_position,
    c.card ->> 'id' as card_id,
    c.card ->> 'prompt' as prompt,
    c.card ->> 'answer' as answer,
    nullif(trim(coalesce(c.card ->> 'example', '')), '') as example,
    nullif(c.card ->> 'lessonId', '') as lesson_id,
    l.title as lesson_title,
    p.box,
    p.due_on,
    coalesce(p.reviews, 0) as reviews,
    c.card as content
  from public.practice_activities a
  join public.modules m on m.id = a.module_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(a.document -> 'cards') = 'array' then a.document -> 'cards' else '[]'::jsonb end
  ) with ordinality as c(card, ord)
  left join public.lessons l on l.id = nullif(c.card ->> 'lessonId', '')
  left join public.practice_card_progress p
    on p.student_id = public.current_student_id()
   and p.activity_id = a.id
   and p.card_id = c.card ->> 'id'
  where a.status = 'published'
    and m.name in (select public.current_student_modules())
    and coalesce(c.card ->> 'id', '') <> ''
    and case a.skill
      when 'speaking' then
        coalesce(c.card ->> 'prompt', '') <> '' and coalesce(c.card ->> 'answer', '') <> ''
      when 'listening' then
        coalesce(c.card ->> 'text', '') <> '' and coalesce(c.card ->> 'audioPath', '') <> ''
      else false
    end
    and (
      nullif(c.card ->> 'lessonId', '') is null
      or exists (
        select 1 from public.student_classes sc
        where sc.lesson_id = c.card ->> 'lessonId'
          and sc.held
      )
    );

revoke all on public.student_practice_cards from anon, authenticated;
grant select on public.student_practice_cards to authenticated;
