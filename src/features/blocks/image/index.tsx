import { useRef, useState } from "react";
import {
  ImageIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { ImageBlock } from "@/lib/lessons";
import { lessonImageUrl, uploadLessonImage } from "@/lib/storage";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

function View({ block }: { block: ImageBlock }) {
  const url = block.path ? lessonImageUrl(block.path) : "";

  // Wallpaper: fill the slide as a full-bleed background. SlideView lifts this
  // block out of the normal flow and gives it a full-size positioned container.
  if (block.wallpaper) {
    return url ? (
      <img
        src={url}
        alt={block.alt ?? ""}
        className="h-full w-full object-cover"
      />
    ) : null;
  }

  return (
    <figure className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      {url ? (
        <img
          src={url}
          alt={block.alt ?? ""}
          className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          <ImageIcon className="size-8" />
        </div>
      )}
      {block.caption && (
        <figcaption className="text-center text-sm italic text-muted-foreground">
          {renderInline(block.caption)}
        </figcaption>
      )}
      {block.note && <BlockNote text={block.note} />}
    </figure>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: ImageBlock;
  onChange: (b: ImageBlock) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  /** Full HD (1080p) — the target for a wallpaper on a computer/projector. */
  const FULL_HD = { w: 1920, h: 1080 };
  const belowFullHd =
    block.wallpaper &&
    dims !== null &&
    (dims.w < FULL_HD.w || dims.h < FULL_HD.h);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const path = await uploadLessonImage(file);
      onChange({ ...block, path });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const url = block.path ? lessonImageUrl(block.path) : "";

  return (
    <div className="space-y-1.5">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {url ? (
        // Uploaded: show the image as it will appear, with explicit controls.
        <div className="space-y-1.5">
          <div className="relative flex min-h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            <img
              src={url}
              alt={block.alt ?? ""}
              onLoad={(e) => {
                setLoadFailed(false);
                setDims({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                });
              }}
              onError={() => setLoadFailed(true)}
              className="mx-auto max-h-80 w-auto max-w-full object-contain"
            />
            {loadFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted-foreground">
                <span className="font-medium text-destructive">
                  Couldn't load image
                </span>
                <span>
                  The upload succeeded, but the public URL isn't readable — check
                  that the <code>lesson-images</code> bucket is public.
                </span>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 break-all underline"
                >
                  Open URL
                </a>
              </div>
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                Uploading…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCwIcon className="size-3.5" />
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...block, path: "" })}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2Icon className="size-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        // Empty: click-to-upload dropzone.
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed transition-colors hover:border-ring/60 hover:bg-accent/40 disabled:opacity-70"
        >
          {uploading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Uploading…
            </span>
          ) : (
            <span className="flex flex-col items-center gap-1.5 py-8 text-sm text-muted-foreground">
              <UploadIcon className="size-6" />
              Click to upload an image
            </span>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {block.wallpaper && (
        <p className="text-xs text-muted-foreground">
          Recommended: <strong>1920 × 1080 px</strong> (Full HD, 16:9).
          {dims && (
            <>
              {" "}
              This image is {dims.w} × {dims.h} px.
            </>
          )}
          {belowFullHd && (
            <span className="text-destructive">
              {" "}
              Below Full HD — it may look soft when scaled to fill the screen.
            </span>
          )}
        </p>
      )}

      <input
        value={block.alt ?? ""}
        onChange={(e) => onChange({ ...block, alt: e.target.value })}
        placeholder="Alt text (for accessibility)"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
      />
      <AutoTextarea
        value={block.caption ?? ""}
        onValueChange={(caption) => onChange({ ...block, caption })}
        placeholder="Caption (optional)"
        className="text-sm italic text-muted-foreground"
      />
      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const imageBlock: BlockDefinition<ImageBlock> = {
  meta: {
    type: "image",
    label: "Image",
    hint: "Upload an image to show on the slide",
    icon: ImageIcon,
  },
  create: () => ({ type: "image", path: "" }),
  View,
  Editor,
};
