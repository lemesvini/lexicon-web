import * as React from "react";
import { useRef, useState } from "react";
import {
  ImageIcon,
  Loader2Icon,
  MessageCircleIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import type { PostBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import { lessonImageUrl, uploadLessonImage } from "@/lib/storage";
import type { BlockDefinition } from "../types";
import { FOREST, INK, JADE, MIST, withAlpha } from "../brand";
import { Markdown } from "../markdown";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

// A social post, drawn as the card it would really be seen in. See `PostBlock`
// in @/lib/lessons for why the card is drawn rather than the words alone.

type PostTheme = NonNullable<PostBlock["theme"]>;

type ThemeTokens = {
  label: string;
  /** The card itself. */
  surface: string;
  /** Its outer edge. */
  border: string;
  /** The display name and the message. */
  text: string;
  /** The handle, and anything else said quietly. */
  muted: string;
  /** Ground of the avatar placeholder. */
  avatar: string;
};

/**
 * The card treatments, and the same four names the `email` block uses.
 *
 * `light` and `dark` are the two a feed actually comes in — use them when the
 * post is the thing being read. `mist` and `forest` are the same card in the
 * brand's greens, for a slide where the post is a piece of the deck rather than
 * a screenshot of the world; they pair with the `title` covers of those names.
 *
 * Flat colour rather than theme tokens, for the reason ../brand gives: which
 * theme the post is in is the author's decision about the post, not about the
 * app. A dark feed projected out of a teacher's light-mode studio must still be
 * a dark card, because that is the thing the class is being shown.
 */
export const POST_THEMES: Record<PostTheme, ThemeTokens> = {
  light: {
    label: "Light",
    surface: "#ffffff",
    border: "#e1e3e6",
    text: "#0f1419",
    muted: "#65707b",
    avatar: "#eff1f3",
  },
  dark: {
    label: "Dark",
    surface: "#16181c",
    border: "#2f3336",
    text: "#e7e9ea",
    muted: "#8b98a5",
    avatar: "#2f3336",
  },
  mist: {
    label: "Mist",
    surface: MIST,
    border: withAlpha(FOREST, 0.22),
    text: FOREST,
    muted: withAlpha(FOREST, 0.65),
    avatar: withAlpha(FOREST, 0.12),
  },
  forest: {
    label: "Forest",
    surface: FOREST,
    border: INK,
    text: MIST,
    muted: JADE,
    avatar: withAlpha(MIST, 0.14),
  },
};

/** The card's treatment, defaulting to light — and falling back to it rather
 *  than throwing on a theme nobody defined, exactly as the email block does. */
function themeOf(block: PostBlock): ThemeTokens {
  return POST_THEMES[block.theme ?? "light"] ?? POST_THEMES.light;
}

/** The handle as it is drawn: one leading `@`, however the author typed it. */
function handleOf(username: string): string {
  const name = username.trim().replace(/^@+/, "");
  return name ? `@${name}` : "";
}

/**
 * The profile picture: the upload when there is one, a user icon when there is
 * not.
 *
 * The fallback is drawn rather than left empty because a post with a hole where
 * the picture goes reads as a broken card, and every feed a student has ever
 * seen fills that circle with exactly this silhouette.
 */
function Avatar({
  t,
  path,
  size = "size-12",
}: {
  t: ThemeTokens;
  path?: string;
  size?: string;
}) {
  const url = path ? lessonImageUrl(path) : "";

  return (
    <div
      className={cn(size, "shrink-0 overflow-hidden rounded-full")}
      style={{ background: t.avatar }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <UserRoundIcon className="size-1/2" style={{ color: t.muted }} />
        </span>
      )}
    </div>
  );
}

function View({ block }: { block: PostBlock }) {
  const t = themeOf(block);
  const handle = handleOf(block.username);
  const imageUrl = block.imagePath ? lessonImageUrl(block.imagePath) : "";

  return (
    <section className="space-y-2.5">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <article
        className="overflow-hidden rounded-2xl p-4 shadow-lg"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          color: t.text,
        }}
      >
        <header className="flex items-center gap-3">
          <Avatar t={t} path={block.avatarPath} />
          <div className="min-w-0">
            {block.displayName && (
              <p className="truncate text-base font-semibold leading-tight">
                {block.displayName}
              </p>
            )}
            {handle && (
              <p
                className="truncate text-sm leading-tight"
                style={{ color: t.muted }}
              >
                {handle}
              </p>
            )}
          </div>
        </header>

        {block.body.trim() !== "" && (
          <div className="mt-3 text-lg leading-relaxed">
            <Markdown text={block.body} />
          </div>
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={block.imageAlt ?? ""}
            className="mt-3 max-h-[45vh] w-full rounded-xl object-cover"
            style={{ border: `1px solid ${t.border}` }}
          />
        )}
      </article>

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

/** Upload state shared by the two pickers below — the profile picture and the
 *  post's own photo are the same upload with a different frame around it. */
function useImageUpload(onDone: (path: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onDone(await uploadLessonImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
      className="hidden"
      onChange={(e) => void handleFile(e.target.files?.[0])}
    />
  );

  return {
    input,
    uploading,
    error,
    pick: () => inputRef.current?.click(),
  };
}

function Editor({
  block,
  onChange,
}: {
  block: PostBlock;
  onChange: (b: PostBlock) => void;
}) {
  const theme = block.theme ?? "light";
  const t = themeOf(block);

  const avatar = useImageUpload((avatarPath) => onChange({ ...block, avatarPath }));
  const photo = useImageUpload((imagePath) => onChange({ ...block, imagePath }));

  const imageUrl = block.imagePath ? lessonImageUrl(block.imagePath) : "";

  return (
    <div className="space-y-2">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      {avatar.input}
      {photo.input}

      {/* Edited inside the card it will be projected in, like the email's
          editor: the theme is a choice about how the post looks, so it has to
          be visible while the words are being written. */}
      <div
        className="rounded-xl p-3"
        style={
          {
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.text,
            "--post-muted": t.muted,
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={avatar.pick}
            disabled={avatar.uploading}
            title="Profile picture"
            aria-label="Profile picture"
            className="relative rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <Avatar t={t} path={block.avatarPath} />
            {avatar.uploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Loader2Icon className="size-4 animate-spin" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <input
              value={block.displayName ?? ""}
              onChange={(e) =>
                onChange({ ...block, displayName: e.target.value })
              }
              placeholder="Display name"
              aria-label="Display name"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[color:var(--post-muted)] placeholder:opacity-60 focus:rounded-sm focus:ring-2 focus:ring-ring/40"
              style={{ color: t.text }}
            />
            <input
              value={block.username}
              onChange={(e) => onChange({ ...block, username: e.target.value })}
              placeholder="@username"
              aria-label="Username"
              className="w-full bg-transparent text-sm outline-none placeholder:opacity-60 focus:rounded-sm focus:ring-2 focus:ring-ring/40"
              style={{ color: t.muted }}
            />
          </div>

          {block.avatarPath && (
            <button
              type="button"
              onClick={() => onChange({ ...block, avatarPath: "" })}
              title="Remove profile picture"
              aria-label="Remove profile picture"
              className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
              style={{ color: t.muted }}
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>

        <AutoTextarea
          value={block.body}
          onValueChange={(body) => onChange({ ...block, body })}
          placeholder="Write the post…"
          aria-label="Post"
          className="mt-2 text-base leading-relaxed placeholder:text-[color:var(--post-muted)] placeholder:opacity-60"
          style={{ color: t.text }}
        />

        {imageUrl ? (
          <div className="relative mt-2">
            <img
              src={imageUrl}
              alt={block.imageAlt ?? ""}
              className="max-h-64 w-full rounded-lg object-cover"
              style={{ border: `1px solid ${t.border}` }}
            />
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                onClick={photo.pick}
                disabled={photo.uploading}
                className="rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...block, imagePath: "" })}
                className="rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-destructive/20"
              >
                Remove
              </button>
            </div>
            {photo.uploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={photo.pick}
            disabled={photo.uploading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: t.border, color: t.muted }}
          >
            {photo.uploading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImageIcon className="size-4" />
                Add a photo (optional)
              </>
            )}
          </button>
        )}
      </div>

      {(avatar.error || photo.error) && (
        <p className="text-xs text-destructive">{avatar.error || photo.error}</p>
      )}

      {block.imagePath && (
        <input
          value={block.imageAlt ?? ""}
          onChange={(e) => onChange({ ...block, imageAlt: e.target.value })}
          placeholder="Photo alt text (for accessibility)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
        />
      )}

      <div className="flex items-center gap-1.5 border-t pt-2">
        {(Object.keys(POST_THEMES) as PostTheme[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, theme: value })}
            aria-label={POST_THEMES[value].label}
            title={POST_THEMES[value].label}
            style={{
              background: POST_THEMES[value].surface,
              borderColor: POST_THEMES[value].border,
            }}
            className={cn(
              "size-5 rounded-full border transition-transform hover:scale-110",
              theme === value &&
                "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background",
            )}
          />
        ))}
      </div>

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const postBlock: BlockDefinition<PostBlock> = {
  meta: {
    type: "post",
    label: "Post",
    hint: "A social post — handle, avatar, message",
    icon: MessageCircleIcon,
  },
  create: () => ({
    type: "post",
    theme: "light",
    username: "",
    displayName: "",
    body: "",
  }),
  View,
  Editor,
};
