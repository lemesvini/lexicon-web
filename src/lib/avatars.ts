// Student profile pictures: the bucket, the upload, and the two ways the path
// gets written back.
//
// The file goes to `student-avatars/{studentId}/{uuid}.{ext}` — the folder is
// the authorisation, and 0009's storage policies read the student id straight
// out of it. Only the object *path* is stored on the row; the public URL is
// derived at render time, the same rule lesson images follow (see ./storage.ts).
//
// Two writers, because there are two kinds of caller and they have different
// rights on `students`:
//
//   setStudentAvatar   staff, writing the roster row they already own.
//   setMyAvatar        the student, through `set_own_avatar` — a security
//                      definer function, because a student may change this one
//                      column and nothing else on their row.

import { supabase } from "@/lib/supabase";

export const STUDENT_AVATAR_BUCKET = "student-avatars";

/** Max upload size. Smaller than a lesson image on purpose: this is displayed
 *  at 96px and a 8 MB portrait helps nobody. */
const MAX_BYTES = 4 * 1024 * 1024;

/** No SVG, unlike lesson images. An avatar is uploaded by a student rather than
 *  by staff authoring a lesson, and an SVG is a script that renders as a
 *  picture — not something to serve back from a public bucket. */
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Uploads a picture for one student and returns its object path.
 *
 * The extension comes from the MIME type rather than the filename: the type is
 * what was validated, and a `.png` that is really a JPEG would otherwise be
 * served with the wrong one.
 */
export async function uploadStudentAvatar(
  studentId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Use a PNG, JPEG or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That picture is too large (max 4 MB).");
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  // A fresh name every time rather than overwriting one: the old URL is in
  // caches and in whatever page is still open, and a replaced object keeps
  // serving the previous bytes until those expire.
  const path = `${studentId}/${id}.${EXTENSION[file.type]}`;

  const { error } = await supabase.storage
    .from(STUDENT_AVATAR_BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type });

  if (error) throw new Error(error.message);
  return path;
}

/**
 * Deletes a stored picture. Best-effort: called after the row already points
 * somewhere else, so a failure here leaves an orphaned object rather than a
 * broken avatar, and is not worth failing the save over.
 */
export async function removeStudentAvatarObject(path: string): Promise<void> {
  await supabase.storage.from(STUDENT_AVATAR_BUCKET).remove([path]);
}

/** Points a student's row at a picture, or clears it with null. Staff only —
 *  the roster's own write policy is what allows this. */
export async function setStudentAvatar(
  studentId: string,
  path: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({ avatar_path: path })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
}

/** The same, for a student changing their own. Goes through `set_own_avatar`,
 *  which finds the row by `auth.uid()` — there is no id to pass, and no id a
 *  caller could pass instead. */
export async function setMyAvatar(path: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_own_avatar", { path });
  if (error) throw new Error(error.message);
}

/** The public URL for a stored path. Pure string building. */
export function studentAvatarUrl(path: string): string {
  return supabase.storage.from(STUDENT_AVATAR_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * The one or two letters shown while there is no picture.
 *
 * First and last of however many words the name has, so "Ana Paula Ribeiro"
 * gives AR rather than AP — the surname is the half that distinguishes two
 * students who share a first name, which is the whole job of this fallback.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
