-- Module management: rename, delete, and move lessons between modules.
--
-- A lesson's module is the free-text `lessons.module` column, matched by name
-- against `modules.name` (that's what the student RLS policy from 0002 compares).
-- Two things make that awkward to edit over plain PostgREST, and both are why
-- these are functions rather than table writes from the client:
--
--   1. `module` is denormalized out of `document`, which is the authoritative
--      copy. Writing one without the other means the next Studio save silently
--      puts the lesson back in its old module.
--   2. Renaming a module has to sweep every lesson tagged with the old name in
--      the same breath, or every student in that module instantly loses access
--      to their lessons.
--
-- security definer, with an explicit is_admin() check at the top of each: the
-- lesson write policies from 0001 are scoped to `created_by = auth.uid()`, so an
-- admin curating the timetable can't otherwise touch a lesson another teacher
-- authored. That restriction is right for the Studio and wrong here.
--
-- Run this in the Supabase SQL editor after 0002. Idempotent — safe to re-run.

-- Moves a set of lessons into a module. Pass '' to unassign them.
create or replace function public.set_lessons_module(
  lesson_ids text[],
  module_name text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change lesson modules.' using errcode = '42501';
  end if;

  update public.lessons
  set module = module_name,
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(module_name),
        true
      )
  where id = any(lesson_ids);

  get diagnostics updated = row_count;
  return updated;
end;
$$;

grant execute on function public.set_lessons_module(text[], text) to authenticated;

-- Renames a module and re-tags every lesson that was in it.
create or replace function public.rename_module(module_id uuid, new_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
  updated integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can rename a module.' using errcode = '42501';
  end if;

  new_name := trim(new_name);
  if new_name = '' then
    raise exception 'A module needs a name.';
  end if;

  select name into old_name from public.modules where id = module_id;
  if old_name is null then
    raise exception 'Module not found.';
  end if;
  if old_name = new_name then
    return 0;
  end if;

  if exists (select 1 from public.modules where name = new_name) then
    raise exception 'There is already a module called "%".', new_name;
  end if;

  update public.modules set name = new_name where id = module_id;

  update public.lessons
  set module = new_name,
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(new_name),
        true
      )
  where module = old_name;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

grant execute on function public.rename_module(uuid, text) to authenticated;

-- Deletes a module, unassigning its lessons first.
--
-- Refuses while any student references it. `student_modules` cascades on delete,
-- so going ahead anyway would quietly erase the history of everyone who has ever
-- been through the module — deactivating it (`is_active = false`) is the right
-- move in that case, and the roster's module picker already hides inactive ones.
create or replace function public.delete_module(module_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete a module.' using errcode = '42501';
  end if;

  select name into old_name from public.modules where id = module_id;
  if old_name is null then
    raise exception 'Module not found.';
  end if;

  if exists (select 1 from public.students where current_module_id = module_id) then
    raise exception 'Move the students out of this module first, or deactivate it instead.';
  end if;

  -- Both sides qualified: `student_modules.module_id` and the parameter share a
  -- name, and plpgsql errors on the ambiguity rather than guessing.
  if exists (
    select 1 from public.student_modules sm
    where sm.module_id = delete_module.module_id
  ) then
    raise exception 'Students have history in this module. Deactivate it instead of deleting it.';
  end if;

  update public.lessons
  set module = '',
      document = jsonb_set(
        coalesce(document, '{}'::jsonb),
        '{module}',
        to_jsonb(''::text),
        true
      )
  where module = old_name;

  delete from public.modules where id = module_id;
end;
$$;

grant execute on function public.delete_module(uuid) to authenticated;
