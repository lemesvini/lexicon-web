-- Writing practice: a sentence in Portuguese, put into English from its words.
--
-- The third skill on 0031's tables, and listening (0032) without the audio. A
-- writing activity is a deck of sentences:
--
--   { "cards": [{ "id", "prompt", "answer", "lessonId"?, "distractors"? }] }
--
--   prompt       the sentence in Portuguese — what is shown
--   answer       the sentence in English — what is built, word by word
--   distractors  words that are not in the answer, offered among its own.
--                Optional: the app borrows some from the other sentences
--
-- `prompt` and `answer` are the speaking card's own names, so the student's view
-- already carries them as columns; only which cards count as complete changes:
-- a writing card needs both, as a speaking card does.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0032.
-- Idempotent — safe to re-run.

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
      when 'writing' then
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
