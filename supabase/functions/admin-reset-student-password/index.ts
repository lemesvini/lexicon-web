// admin-reset-student-password: issues a new temporary password for a student.
//
// With no email configured (see admin-create-student for why), a student who
// forgets their password has no self-service way back in. This is that way back:
// an admin generates a fresh temporary password, reads it out, and the student
// is forced to change it at next login.
//
// Deploy: supabase functions deploy admin-reset-student-password

import { z } from "npm:zod@^4.4.3";
import {
  generateTempPassword,
  handle,
  HttpError,
  json,
  requireStaff,
} from "../_shared/admin.ts";

const bodySchema = z.object({ studentId: z.uuid() });

Deno.serve(
  handle(async (req) => {
    const { service, callerId, isAdmin } = await requireStaff(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { data: student, error: studentError } = await service
      .from("students")
      .select("id, email, user_id, teacher_id")
      .eq("id", parsed.data.studentId)
      .maybeSingle();

    if (studentError) throw new HttpError(500, studentError.message);
    if (!student) throw new HttpError(404, "Student not found.");
    // The query above runs on the service client, which bypasses RLS — so the
    // check the roster's policies would have made has to be made here instead.
    // Reported as a 404 rather than a 403: whether another teacher has a student
    // by that id is not this caller's business.
    if (!isAdmin && student.teacher_id !== callerId) {
      throw new HttpError(404, "Student not found.");
    }
    if (!student.user_id) {
      throw new HttpError(409, "This student has no account yet.");
    }

    const tempPassword = generateTempPassword();

    // Read the current metadata first and write it back with the flag flipped:
    // passing user_metadata replaces the object, so a blind write would drop
    // full_name.
    const { data: existing } = await service.auth.admin.getUserById(student.user_id);

    const { error: updateError } = await service.auth.admin.updateUserById(
      student.user_id,
      {
        password: tempPassword,
        user_metadata: {
          ...(existing?.user?.user_metadata ?? {}),
          must_change_password: true,
        },
      },
    );

    if (updateError) throw new HttpError(500, updateError.message);

    return json({ email: student.email, tempPassword });
  }),
);
