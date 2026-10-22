-- Reading practice: a text, then questions on it.
--
-- The fourth and last skill on 0031's tables, after the shape of the web's
-- reading library (src/features/practice/data/readings.ts): a short text with
-- multiple-choice comprehension questions. A reading activity is a deck of
-- texts:
--
--   { "cards": [{ "id", "title", "level"?, "blurb"?, "lessonId"?,
--                 "paragraphs": [text, …],
--                 "questions": [{ "id", "prompt", "options": [text, …],
--                                 "answer": 0-based index }] }] }
--
-- A text is one card to the spaced repetition: how many of its questions were
-- right decides when it comes back, as a whole. The answers travel with the
-- card — this is practice, marked on the phone, not homework handed in.
--
-- Complete enough to show: a title, at least one paragraph and at least one
-- question.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0033.
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
      -- The length behind a CASE, not an AND: Postgres doesn't promise to test
      -- the type first, and jsonb_array_length throws on anything but an array.
      when 'reading' then
        coalesce(c.card ->> 'title', '') <> ''
        and case when jsonb_typeof(c.card -> 'paragraphs') = 'array'
              then jsonb_array_length(c.card -> 'paragraphs') else 0 end > 0
        and case when jsonb_typeof(c.card -> 'questions') = 'array'
              then jsonb_array_length(c.card -> 'questions') else 0 end > 0
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
