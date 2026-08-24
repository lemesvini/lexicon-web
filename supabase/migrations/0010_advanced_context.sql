-- Advanced context: a module copied per group, and what the model reads to
-- suggest additions to it.
--
-- Until now a lesson was the same document for every class that ever saw it.
-- That is right for the material and wrong for the room: two groups working
-- through the same unit are not the same two rooms, and a teacher who wants to
-- put one extra example in front of *this* class has had only one place to put
-- it — the shared lesson, where everybody else gets it too.
--
-- So a group gets copies. `group_lessons` holds one editable copy of each lesson
-- in the group's module, with the date it is expected to happen. The copy is the
-- whole document, not a patch: the presenter reads one row and renders it, with
-- no merge at display time, which is the property worth paying a little
-- duplication for when the thing being rendered is on a projector in front of a
-- class. Blocks the teacher adds to a copy carry `advancedContext: true` inside
-- the JSON (see src/lib/lessons.ts) — that flag, not a column, is what tells the
-- editor which slides are the untouchable base and which are theirs.
--
-- `base_synced_at` is the honest admission that copies drift. It records
-- `lessons.updated_at` at the moment of the copy, so the app can say "the base
-- lesson changed since you copied it" and offer to rebuild — rather than
-- pretending the copy is live, or silently overwriting a teacher's work.
--
-- `student_unit_reports` is the other half. A per-unit record of what happened
-- and how the test went is something a teacher already carries in their head;
-- writing it down is what lets the suggestion be about this class rather than
-- about the lesson in the abstract. Together with `groups.context` (new here)
-- and `students.notes` (0002, which has always been the student-level version of
-- the same thing) it is the whole input to the model.
--
-- Nothing here is student-readable. A group's copy is projected by the teacher,
-- and a unit report contains the teacher's own notes about a test. If a student
-- view of their reports is ever wanted, the way in is a view like
-- `student_lessons` (0004), not a policy on these tables.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0009.
-- Idempotent — safe to re-run.
--
-- Edge Functions: adds one, `suggest-advanced-context`, which reads every table
-- below with the service role and needs the `ANTHROPIC_API_KEY` secret.

-- The group's own context -----------------------------------------------------
-- Free text, deliberately. It mirrors `students.notes`: the thing you would
-- otherwise keep in a spreadsheet — who this class is, what they are for, what
-- keeps going wrong. Structure would only make it harder to write and no easier
-- for a model to read.

alter table public.groups
  add column if not exists context text;

-- The module the group is working through. Not the source of truth for what the
-- group has — the rows in `group_lessons` are — just the last choice made on the
-- Lessons tab, so the picker knows what to preselect and the "lessons in this
-- module you haven't added yet" list has something to compare against.
alter table public.groups
  add column if not exists module_id uuid
    references public.modules(id) on delete set null;

-- The copies -------------------------------------------------------------------

create table if not exists public.group_lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,

  -- The full document: the base lesson plus whatever this group added.
  document jsonb not null,

  -- When this class is expected to happen. Seeded from the group's meeting days
  -- and freely edited afterwards, because a plan is a guess and terms have
  -- holidays in them.
  scheduled_on date,

  -- Order within the group, seeded from `lessons.order`. Kept separate from that
  -- column because a group may add lessons from more than one module, and
  -- because reordering for one class must not reorder the curriculum.
  position int not null default 0,

  -- `lessons.updated_at` when this copy was made. Null means "unknown" (a row
  -- written before this was tracked), which the app treats as "don't offer to
  -- rebuild" rather than as "out of date".
  base_synced_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One copy of a lesson per group. This is what makes "add the module's
  -- lessons" safely repeatable: the second click conflicts and is ignored
  -- instead of overwriting a document somebody has been editing.
  unique (group_id, lesson_id)
);

create index if not exists group_lessons_group_idx
  on public.group_lessons (group_id, position);

drop trigger if exists group_lessons_set_updated_at on public.group_lessons;
create trigger group_lessons_set_updated_at
  before update on public.group_lessons
  for each row execute function public.set_updated_at();

alter table public.group_lessons enable row level security;

-- `owns_group` (0007) is already "admin, or the staff member this group belongs
-- to" — the same predicate that guards the group itself, which is the right
-- answer here: a copy of a lesson for a group is part of that group.
drop policy if exists "group_lessons_own" on public.group_lessons;
create policy "group_lessons_own"
  on public.group_lessons
  for all
  to authenticated
  using (public.owns_group(group_id))
  with check (public.owns_group(group_id));

-- Per-unit progress reports -----------------------------------------------------

create table if not exists public.student_unit_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,

  -- The unit number within the module. A smallint rather than a reference to
  -- anything: units are not rows anywhere — they are a text field on a lesson.
  unit smallint not null,

  -- What happened over the unit.
  observations text,

  -- The test. Same 0–10 scale as `homework_submissions.score` (0005), so the two
  -- numbers a teacher sees about a student mean the same thing.
  test_score numeric(4,2) check (test_score between 0 and 10),

  -- The teacher's read on the test — separate from `observations` because one is
  -- about the weeks and the other is about the paper.
  teacher_notes text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (student_id, module_id, unit)
);

create index if not exists student_unit_reports_student_idx
  on public.student_unit_reports (student_id, module_id, unit);

drop trigger if exists student_unit_reports_set_updated_at on public.student_unit_reports;
create trigger student_unit_reports_set_updated_at
  before update on public.student_unit_reports
  for each row execute function public.set_updated_at();

alter table public.student_unit_reports enable row level security;

-- `owns_student` (0006): admin, or the staff member whose roster they are on.
-- Note what this does NOT include — the student. A report holds the teacher's
-- notes about a test, and 0006's `students_select_own_or_teacher` deliberately
-- has no counterpart here.
drop policy if exists "student_unit_reports_own" on public.student_unit_reports;
create policy "student_unit_reports_own"
  on public.student_unit_reports
  for all
  to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
