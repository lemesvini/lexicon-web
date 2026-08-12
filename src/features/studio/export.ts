import type { Lesson } from "@/lib/lessons";

/** Filesystem-safe slug for the download filename. */
function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function lessonToJson(lesson: Lesson): string {
  return JSON.stringify(lesson, null, 2) + "\n";
}

export function downloadLesson(lesson: Lesson): void {
  const json = lessonToJson(lesson);
  const name = slugify(lesson.id || lesson.title, "lesson");
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Copies the lesson JSON to the clipboard. Returns false if unsupported/denied. */
export async function copyLesson(lesson: Lesson): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(lessonToJson(lesson));
    return true;
  } catch {
    return false;
  }
}
