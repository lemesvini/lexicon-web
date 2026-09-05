-- Pages a lesson frames, hosted by us.
--
-- The `embed` block frames a live page on a slide. For most of what a teacher
-- wants — a YouTube clip, a map — the publisher hosts it and the block just
-- points at it. For a Claude artifact it cannot: those are served with
-- `frame-ancestors 'self' *.anthropic.com claude.com …`, so the browser refuses
-- to frame one anywhere but on Anthropic's own pages. The interactive still
-- belongs in the lesson, so we host the file ourselves and frame that.
--
-- Hence a bucket rather than a column: what is uploaded is a self-contained HTML
-- page, and the block stores its object *path* — the same rule as lesson images
-- and student avatars (see src/lib/storage.ts), so moving the project doesn't
-- invalidate every lesson that frames something.
--
-- Public read, staff-only write. A lesson page is projected in a classroom and
-- read in a student's material, which is every bit as public as the lesson text
-- it sits beside; writing one is authoring, which is `is_staff()` (0006).
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0022.
-- Idempotent — safe to re-run.

insert into storage.buckets (id, name, public)
values ('lesson-embeds', 'lesson-embeds', true)
on conflict (id) do update set public = true;

drop policy if exists "lesson_embeds_read" on storage.objects;
create policy "lesson_embeds_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'lesson-embeds');

drop policy if exists "lesson_embeds_insert" on storage.objects;
create policy "lesson_embeds_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'lesson-embeds' and public.is_staff());

drop policy if exists "lesson_embeds_update" on storage.objects;
create policy "lesson_embeds_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'lesson-embeds' and public.is_staff())
  with check (bucket_id = 'lesson-embeds' and public.is_staff());

-- Replacing the page a block frames leaves the old object behind; this is what
-- lets it be swept up rather than kept for ever.
drop policy if exists "lesson_embeds_delete" on storage.objects;
create policy "lesson_embeds_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'lesson-embeds' and public.is_staff());
