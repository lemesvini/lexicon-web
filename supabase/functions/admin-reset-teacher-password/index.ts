// admin-reset-teacher-password: issues a new temporary password for a teacher.
//
// The sibling of admin-reset-student-password, and the only way back in for a
// teacher who has forgotten theirs — there is no email configured to send a
// reset link through (see admin-create-student). Admin only: a teacher resetting
// another teacher's password is not a thing this app does.
//
// Deploy: supabase functions deploy admin-reset-teacher-password

import { z } from "npm:zod@^4.4.3";
import {
  generateTempPassword,
  handle,
  HttpError,
  json,
  requireAdmin,
} from "../_shared/admin.ts";

const bodySchema = z.object({ teacherId: z.uuid() });

Deno.serve(
  handle(async (req) => {
    const { service } = await requireAdmin(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { data: teacher, error: teacherError } = await service
      .from("profiles")
      .select("id, email, role")
      .eq("id", parsed.data.teacherId)
      .maybeSingle();

    if (teacherError) throw new HttpError(500, teacherError.message);
    if (!teacher) throw new HttpError(404, "Teacher not found.");
    if (teacher.role !== "teacher") {
      throw new HttpError(409, "That account is not a teacher.");
    }

    const tempPassword = generateTempPassword();

    // Metadata is read and written back rather than replaced: passing
    // user_metadata overwrites the object, so a blind write would drop
    // full_name.
    const { data: existing } = await service.auth.admin.getUserById(teacher.id);

    const { error: updateError } = await service.auth.admin.updateUserById(teacher.id, {
      password: tempPassword,
      user_metadata: {
        ...(existing?.user?.user_metadata ?? {}),
        must_change_password: true,
      },
    });

    if (updateError) throw new HttpError(500, updateError.message);

    return json({ email: teacher.email, tempPassword });
  }),
);
