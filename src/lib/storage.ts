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

// ── Embedded pages ──────────────────────────────────────────────────────────
// The `embed` block frames a live page. When the publisher won't allow theirs to
// be framed — a Claude artifact is served `frame-ancestors 'self' …anthropic.com`
// and so cannot be shown anywhere but on their own site — the page is uploaded
// here and we host it instead. Bucket `lesson-embeds`, created by migration
// 0023: public read, staff-only write.

export const LESSON_EMBED_BUCKET = "lesson-embeds";

/** Max page size (4 MB). A self-contained artifact — markup, styles, script and
 *  any inlined data URIs — is well under this; anything larger is a file that
 *  wanted to be a website. */
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

/**
 * Uploads a self-contained HTML page and returns its object path.
 *
 * The content type is forced rather than taken from the file: a browser hands
 * over `text/html` for a `.html` file on macOS and an empty string on some
 * Windows builds, and a page stored as `application/octet-stream` downloads
 * instead of rendering when the iframe asks for it.
 */
export async function uploadLessonPage(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".html") && !name.endsWith(".htm")) {
    throw new Error("Upload an .html file — the page saved from the artifact.");
  }
  if (file.size > MAX_PAGE_BYTES) {
    throw new Error("Page is too large (max 4 MB).");
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `pages/${id}.html`;

  const { error } = await supabase.storage
    .from(LESSON_EMBED_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "text/html; charset=utf-8",
    });

  if (error) throw new Error(error.message);
  return path;
}

/** Derives the public URL for a stored page. Pure string building. */
export function lessonPageUrl(path: string): string {
  return supabase.storage.from(LESSON_EMBED_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * Reads a stored page back as markup.
 *
 * Why the file is fetched rather than pointed at: Storage does not serve
 * user-uploaded HTML as `text/html` — whatever content type it was uploaded
 * with, it comes back as text, and an iframe pointed at it renders the source
 * code on the slide instead of the page. Fetching the markup and handing it to
 * the iframe as `srcdoc` takes the content type out of it: markup in an iframe
 * is parsed as HTML by definition.
 */
export async function fetchLessonPage(path: string): Promise<string> {
  const response = await fetch(lessonPageUrl(path));
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "That page is no longer in storage."
        : `Couldn't load the page (${response.status}).`,
    );
  }
  return response.text();
}
