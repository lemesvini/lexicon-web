# Supabase setup

Everything in this folder is applied to the hosted project, not checked into a
running local stack. Do the steps in order — the app is unusable between step 1
and step 3.

## 1. Run the migrations

Paste each file in `migrations/` into the SQL editor, oldest first. They are all
idempotent, so re-running one is safe.

- `0001_create_lessons.sql` — the lesson library (already applied on existing projects)
- `0002_students_and_access.sql` — roles, modules, students, and the RLS that isolates them
- `0003_module_management.sql` — the RPCs behind the Modules screen (rename, delete, move lessons)
- `0004_student_materials_and_homework.sql` — what the student reads, and the views they read it through
- `0005_homework_exercises.sql` — homework the student answers and the teacher corrects
- `0006_teachers.sql` — the teacher role, and students belonging to the teacher who created them
- `0007_groups_and_finances.sql` — what each student pays, and the groups they're taught in
- `0008_group_weekdays.sql` — the days of the week a group meets, which the dashboard reads as today's classes

## 2. Check you're still an admin

`0002` ends with a backfill that gives every user who existed before it an
`admin` profile. Confirm it caught your account:

```sql
select email, role from public.profiles order by role, email;
```

If your account came out as `student`, fix it before going any further —
otherwise the app will bounce you out of `/students` and every other teacher
page:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

The signup trigger never reads a role from user metadata (that would let anyone
hitting the public signup endpoint make themselves an admin), so a role is always
either set by a deliberate SQL statement or by an Edge Function holding the
`service_role` key.

Since `0006` there are three roles. Adding a teacher is a page in the app now
(**Teachers**, admin only), but the SQL equivalent is:

```sql
update public.profiles set role = 'teacher' where email = 'them@example.com';
```

Everything a teacher can reach is what an admin can reach minus that page. What
differs is scope: `students.teacher_id` says who a student belongs to, and a
teacher's roster and corrections queue are limited to their own. The curriculum —
lessons, modules, materials, homework — is shared by everyone.

## 3. Close public signup

Dashboard → Authentication → Sign In / Providers → turn **off** "Allow new users
to sign up".

The app never calls `signUp`, but the endpoint is publicly reachable with the
anon key by default. Nothing catastrophic happens if someone slips through — the
trigger makes them a role-less student, and `_student/route.tsx` signs out anyone
without a roster row — but there is no reason to leave it open.

## 4. Deploy the Edge Functions

These hold the `service_role` key, which is why account creation can't happen in
the browser. First time only:

```sh
brew install supabase/tap/supabase   # or see supabase.com/docs/guides/cli
supabase init                        # creates supabase/config.toml
supabase link --project-ref kiqsxytmlgsrzujunauh
```

The project ref is the subdomain of `VITE_SUPABASE_URL` in `.env.local`
(`https://<ref>.supabase.co`). It's also the last segment of the dashboard URL,
and shown under Project Settings → General → Reference ID. It isn't a secret —
it's in the URL of every request the app makes.

Then, and after any change to `functions/`:

```sh
supabase functions deploy admin-create-student
supabase functions deploy admin-reset-student-password
supabase functions deploy admin-create-teacher
supabase functions deploy admin-reset-teacher-password
```

No secrets to configure: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
injected into every Edge Function by the platform.

## Why there are no invite emails

Supabase's built-in email service only delivers to addresses that are members of
the project's team, and is capped at 2 messages an hour. An invite email to a
real student would just fail. So `admin-create-student` creates the account
already confirmed, with a generated temporary password that the admin copies out
of the dialog and passes on; the student is forced to change it at first login.

To switch to real invites later: set up custom SMTP in the dashboard
(Authentication → Emails; Resend's free tier is 3,000/month, 100/day, one
verified domain) and swap `createUser` for `auth.admin.inviteUserByEmail` in
`functions/admin-create-student/index.ts`. Everything else — the roster insert,
the module history, the RLS — stays as it is.

## Storage

Not covered by any migration: a Storage bucket named `lesson-images` with public
read and an insert policy for `authenticated`. See the comment at the top of
`src/lib/storage.ts`.
