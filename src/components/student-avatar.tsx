import * as React from "react";
import { CameraIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  initialsOf,
  removeStudentAvatarObject,
  studentAvatarUrl,
  uploadStudentAvatar,
} from "@/lib/avatars";

const SIZE = {
  sm: "size-9 text-xs",
  md: "size-14 text-base",
  lg: "size-24 text-2xl",
} as const;

/**
 * A student's picture, or their initials when there isn't one.
 *
 * Initials rather than a silhouette: a page of identical grey heads tells the
 * reader nothing, and two letters at least distinguish one row from the next.
 *
 * `key`ed on the path so swapping pictures remounts the `img` — React keeps the
 * previously decoded frame on screen through a `src` change, which during an
 * upload means the old face lingering after the new one has saved.
 */
export function StudentAvatar({
  name,
  path,
  size = "md",
  className,
}: {
  name: string;
  /** Storage object path, or empty for none. */
  path: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);

  const shell = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-muted-foreground select-none",
    SIZE[size],
    className,
  );

  // A path that 404s (the object swept up, the bucket emptied) falls back to
  // the initials rather than leaving a broken-image glyph beside a name.
  if (!path || broken) {
    return (
      <span className={shell} aria-hidden>
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <img
      key={path}
      src={studentAvatarUrl(path)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn(shell, "object-cover")}
    />
  );
}

/**
 * The same picture, with a way to change it.
 *
 * The whole avatar is the control — a separate "upload" button beside a picture
 * asks the reader to work out that the two are related, when clicking the thing
 * you want to replace is what everyone tries first. The camera badge is there
 * to say so before they try.
 *
 * Uploads first, then saves the path, then sweeps the old object. In that
 * order: a row pointing at an object that isn't there yet is a broken avatar,
 * whereas an object nothing points at is only wasted bytes.
 */
export function StudentAvatarUpload({
  studentId,
  name,
  path,
  size = "lg",
  /** Writes the new path — the roster row for staff, `set_own_avatar` for the
   *  student themselves. Which one is the caller's business, not this
   *  component's. */
  onSave,
  disabled = false,
}: {
  studentId: string;
  name: string;
  path: string;
  size?: keyof typeof SIZE;
  onSave: (path: string | null) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFailure("");
    try {
      const next = await uploadStudentAvatar(studentId, file);
      await onSave(next);
      if (path) await removeStudentAvatarObject(path);
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setFailure("");
    try {
      await onSave(null);
      if (path) await removeStudentAvatarObject(path);
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          aria-label={path ? `Change ${name}’s picture` : `Add a picture for ${name}`}
          className="group relative block rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <StudentAvatar name={name} path={path} size={size} />

          {/* Sits over the picture on hover and whenever there isn't one, so an
              empty avatar reads as a slot to fill rather than a missing image. */}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity",
              busy || !path
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
            aria-hidden
          >
            {busy ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : (
              <CameraIcon className="size-5" />
            )}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            // Cleared so picking the same file twice in a row fires `change`
            // again — otherwise a failed upload can't be retried as-is.
            event.target.value = "";
          }}
        />
      </div>

      {path && !busy && !disabled && (
        <button
          type="button"
          onClick={() => void clear()}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Remove
        </button>
      )}

      {failure && (
        <p className="max-w-48 text-center text-xs text-destructive">{failure}</p>
      )}
    </div>
  );
}
