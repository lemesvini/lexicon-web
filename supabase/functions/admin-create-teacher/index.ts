// admin-create-teacher: gives someone a teacher account.
//
// The same shape as admin-create-student, and for the same reason: creating an
// auth account needs the service_role key, which has nowhere to live in a
// browser-only SPA. No email is sent (see admin-create-student for why) — the
// account is created already confirmed with a temporary password, returned once
// for the admin to hand over, and the teacher must replace it at first login.
//
// A teacher has no roster row of their own; `profiles` is the whole record. The
// on_auth_user_created trigger from 0002 writes that row as a student, so the
// role is set immediately afterwards — deliberately here, with the service_role
// key, rather than being read from sign-up metadata the account holder controls.
//
// Deploy: supabase functions deploy admin-create-teacher

import { z } from "npm:zod@^4.4.3";
import {
  generateTempPassword,
  handle,
  HttpError,
  json,
  requireAdmin,
} from "../_shared/admin.ts";

const bodySchema = z.object({
  fullName: z.string().trim().min(1, "Name is required."),
  email: z.email("Enter a valid email.").transform((value) => value.trim().toLowerCase()),
});

Deno.serve(
  handle(async (req) => {
    const { service } = await requireAdmin(req);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    const { fullName, email } = parsed.data;

    const { data: existing, error: existingError } = await service
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();
    if (existingError) throw new HttpError(500, existingError.message);
    if (existing) {
      throw new HttpError(
        409,
        existing.role === "student"
          ? "That email already belongs to a student."
          : "There is already an account with this email.",
      );
    }

    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, must_change_password: true },
    });

    if (createError || !created.user) {
      const message = createError?.message ?? "Could not create the account.";
      throw new HttpError(/already/i.test(message) ? 409 : 500, message);
    }

    const userId = created.user.id;

    // Until this update lands the account exists as a student, so a failure here
    // leaves someone with the wrong role rather than merely a stray account.
    // Undo it rather than reporting a half-made teacher.
    try {
      const { data: profile, error: profileError } = await service
        .from("profiles")
        .update({ role: "teacher", full_name: fullName, status: "active" })
        .eq("id", userId)
        .select("id, email, full_name, role, status, created_at")
        .single();

      if (profileError) throw new HttpError(500, profileError.message);

      return json({ teacher: profile, tempPassword }, 201);
    } catch (err) {
      await service.auth.admin.deleteUser(userId).catch(() => {});
      throw err;
    }
  }),
);
