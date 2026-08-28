-- The class deck, as the students saw it.
--
-- Until now the presentation was the one document students could not reach.
-- 0004 closed `lessons` to them for a good reason — the deck carries teacher
-- notes and answer keys, and RLS is row-level, so `select document` handed over
-- the lot. The material was authored separately and that was the student's copy.
--
-- What students actually ask for is the slides that were on the wall: the same
-- deck, in the same order, including whatever their teacher added for their
-- class. So the deck gets a door of its own, cut exactly like `student_lessons`:
--
--   * their GROUP'S copy (`group_lessons`, 0010) when there is one, else the
--     shared lesson — the same "the copy was made FOR these students" rule the
--     material and the homework already follow;
--   * scrubbed on the way out by `strip_teacher_content` (0004) and
--     `strip_answer_keys` (0005), so a teacher note or an answer key can no more
--     leave through this view than through the other two;
--   * only for a lesson the student can already open. `student_lessons` is the
--     whole gate: if their lesson page exists, its deck exists; if the material
--     is still a draft, there is no page for the deck to hang off and no row
--     here either.
--
-- That last rule is why this view has no `status` of its own. `group_lessons`
-- never had one — a group copy is a live teaching document, edited between
-- classes — and inventing a publication flag for it here would mean a second
-- thing to remember to switch on before a class could read back its own lesson.
-- Publishing the material is the act that opens the lesson; the deck follows it.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0017.
-- Idempotent — safe to re-run.

drop view if exists public.student_presentations;
create view public.student_presentations as
  select
    l.id,
    -- Both stripping functions, in the order they are cheapest to reason about:
    -- lose the teacher's half of the document, then lose any answer left in what
    -- remains. A presentation is not a homework, but it is full of exercises the
    -- teacher reveals in the room, and a student reading the deck back at home
    -- should get the question rather than the key.
    public.strip_answer_keys(
      public.strip_teacher_content(coalesce(g.document, l.document))
    ) as document,
    greatest(l.updated_at, g.updated_at) as updated_at
  from public.lessons l
  -- The view is owned by the migration runner, so the RLS on `group_lessons`
  -- does not apply here — this join is the access rule, the same way it is in
  -- `student_lessons`. Most recently edited copy wins, because a student can be
  -- in more than one group (0013).
  left join lateral (
    select gl.document, gl.updated_at
    from public.group_lessons gl
    join public.group_students gs on gs.group_id = gl.group_id
    where gl.lesson_id = l.id
      and gs.student_id = public.current_student_id()
    order by gl.updated_at desc
    limit 1
  ) g on true
  -- The gate, deferred in full to the view that already answers this question.
  -- Staff get every deck they can already open a lesson page for, which is what
  -- makes this previewable from the Studio.
  where exists (
    select 1 from public.student_lessons sl where sl.id = l.id
  );

revoke all on public.student_presentations from anon, authenticated;
grant select on public.student_presentations to authenticated;
