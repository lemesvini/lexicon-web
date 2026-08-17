// admin-create-student: adds a student to the roster and gives them an account.
//
// Called by any staff account. The student belongs to whoever created them (see
// `students.teacher_id` in supabase/migrations/0006_teachers.sql), which is what
// keeps one teacher's roster and corrections queue out of another's; an admin
// may name a different teacher instead, and sees everyone regardless.
//
// Deliberately sends no email. Supabase's built-in SMTP only delivers to the
// project's own team members and is capped at 2 messages an hour, so an invite
// email would silently fail for real students. Instead the account is created
// already confirmed with a generated temporary password, which is returned once
// for the admin to hand over; the student is forced to change it at first login
// (the `must_change_password` flag in user_metadata).
//
// To switch to real invite emails later: configure custom SMTP in the dashboard
// and swap createUser for auth.admin.inviteUserByEmail here — the roster insert
// below stays exactly the same.
//
// Deploy: supabase functions deploy admin-create-student

import { z } from "npm:zod@^4.4.3";
import {
  generateTempPassword,
  handle,
  HttpError,
  json,
  requireStaff,
} from "../_shared/admin.ts";

const bodySchema = z.object({
  fullName: z.string().trim().min(1, "Name is required."),
  email: z.email("Enter a valid email.").transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().optional(),
  currentModuleId: z.uuid().nullish(),
  // Admin only: which teacher the student belongs to. Ignored for a teacher,
  // who can only ever add to their own roster.
  teacherId: z.uuid().nullish(),
});

Deno.serve(
  handle(async (req) => {
    const { service, callerId, isAdmin } = await requireStaff(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    const { fullName, email, phone, currentModuleId, teacherId } = parsed.data;

    // A teacher's students are their own, full stop — the field is only read
    // for an admin, who is adding on someone else's behalf.
    const owner = isAdmin ? (teacherId ?? callerId) : callerId;

    if (isAdmin && teacherId && teacherId !== callerId) {
      const { data: teacher, error: teacherError } = await service
        .from("profiles")
        .select("role")
        .eq("id", teacherId)
        .maybeSingle();
      if (teacherError) throw new HttpError(500, teacherError.message);
      if (teacher?.role !== "teacher" && teacher?.role !== "admin") {
        throw new HttpError(400, "That teacher no longer exists.");
      }
    }

    const { data: existing, error: existingError } = await service
      .from("students")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingError) throw new HttpError(500, existingError.message);
    if (existing) throw new HttpError(409, "A student with this email already exists.");

    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      // Confirms the address without sending anything — see the note above.
      email_confirm: true,
      user_metadata: { full_name: fullName, must_change_password: true },
    });

    if (createError || !created.user) {
      const message = createError?.message ?? "Could not create the account.";
      // GoTrue reports a taken address as a 422; surface it as a conflict so the
      // dialog can say something useful.
      throw new HttpError(/already/i.test(message) ? 409 : 500, message);
    }

    const userId = created.user.id;

    // From here on, any failure leaves an orphaned auth account behind, so undo
    // it before returning. There is no transaction spanning auth and the roster.
    try {
      const { data: student, error: insertError } = await service
        .from("students")
        .insert({
          user_id: userId,
          full_name: fullName,
          email,
          phone: phone || null,
          status: "active",
          current_module_id: currentModuleId ?? null,
          teacher_id: owner,
          created_by: callerId,
        })
        .select(
          "id, full_name, email, phone, status, current_module_id, teacher_id, created_at",
        )
        .single();

      if (insertError) throw new HttpError(500, insertError.message);

      if (currentModuleId) {
        const { error: historyError } = await service.from("student_modules").insert({
          student_id: student.id,
          module_id: currentModuleId,
          status: "in_progress",
        });
        if (historyError) throw new HttpError(500, historyError.message);
      }

      return json({ student, tempPassword }, 201);
    } catch (err) {
      await service.auth.admin.deleteUser(userId).catch(() => {});
      throw err;
    }
  }),
);
