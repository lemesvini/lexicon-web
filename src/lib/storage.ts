// Supabase Storage helpers for lesson assets.
//
// Studio uploads images here; blocks persist only the returned object *path*
// (not a full URL), and the public URL is derived at render time via
// `lessonImageUrl`. Keeping the path (rather than a baked-in URL) means the
// exported lesson JSON survives a change to the project's public base URL.
//
// Requires a Storage bucket named `lesson-images` in the Supabase project with
// public read access and an RLS policy allowing `authenticated` inserts.

import { supabase } from "@/lib/supabase";

export const LESSON_IMAGE_BUCKET = "lesson-images";

/** Max upload size (8 MB) — guards against accidentally uploading huge files. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

/**
 * Uploads an image to the lesson-images bucket and returns its object path.
 * Throws with a human-readable message on validation or upload failure.
 */
export async function uploadLessonImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Unsupported file type — use PNG, JPEG, WebP, GIF, or SVG.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large (max 8 MB).");
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "bin";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `images/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(LESSON_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw new Error(error.message);
  return path;
}

/** Derives the public URL for a stored object path. Pure string building. */
export function lessonImageUrl(path: string): string {
  return supabase.storage.from(LESSON_IMAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}
