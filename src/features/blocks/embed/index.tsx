import { useEffect, useRef, useState } from "react";
import {
  GlobeIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { EmbedBlock } from "@/lib/lessons";
import { fetchLessonPage, uploadLessonPage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

// A live page on the slide. See `EmbedBlock` in @/lib/lessons for what it is
// for; this module is the frame around it and nothing else — everything inside
// the iframe belongs to whoever wrote the page.
//
// There are two ways to fill the frame, and the second exists because of a wall
// the first one hits. A URL is the ordinary case. But a publisher may refuse to
// be framed at all (`X-Frame-Options`, `frame-ancestors`), and Claude artifacts
// do exactly that — their embed URL names Anthropic's own domains and nobody
// else's, so pointing at one from here shows "refused to connect" whatever we
// write. For those, the page's HTML is uploaded and we host it: `block.path`.

type Aspect = NonNullable<EmbedBlock["aspect"]>;

/**
 * The shapes a frame may take, as CSS ratios.
 *
 * A ratio rather than a height, because a slide has no fixed size: the presenter
 * lays one out at the projector's resolution, the studio draws the same slide
 * scaled into a preview card, and a student reads it in a phone-width column.
 * A height in pixels would be right on exactly one of the three.
 */
export const EMBED_ASPECTS: Record<Aspect, { label: string; ratio: string }> = {
  "16:9": { label: "16 : 9", ratio: "16 / 9" },
  "4:3": { label: "4 : 3", ratio: "4 / 3" },
  "1:1": { label: "1 : 1", ratio: "1 / 1" },
  "3:4": { label: "3 : 4", ratio: "3 / 4" },
};

/**
 * Turning the address a teacher copied into one that can actually be framed.
 *
 * Most sites publish a *page* at their share URL and refuse to be put in an
 * iframe, while serving a second, frameable address for exactly this purpose.
 * `youtu.be/<id>` is the page and refuses; `youtube.com/embed/<id>` is the
 * player and does not. Nobody should have to know that — the teacher pastes what
 * they copied, and this rewrites it.
 *
 * Everything not recognised here is framed exactly as typed. This is a
 * convenience over the URL, not a whitelist: an unknown site is passed straight
 * through, and whether it agrees to be framed is between it and the browser.
 */
function embedUrl(parsed: URL): string | null {
  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/$/, "");

  // YouTube: the share link, the watch page, a Short and a live URL all carry
  // the same eleven-character id, and the player lives at /embed/<id>.
  const youtubeId =
    host === "youtu.be"
      ? path.slice(1)
      : host === "youtube.com" || host === "m.youtube.com"
        ? (path === "/watch"
            ? (parsed.searchParams.get("v") ?? "")
            : /^\/(shorts|live|embed)\/([\w-]+)$/.exec(path)?.[2]) ?? ""
        : "";
  if (/^[\w-]{11}$/.test(youtubeId)) {
    // `t` is how a teacher cues a clip; it survives as the player's own param.
    const start =
      parsed.searchParams.get("t") ?? parsed.searchParams.get("start") ?? "";
    const seconds = /^(\d+)s?$/.exec(start)?.[1];
    return `https://www.youtube.com/embed/${youtubeId}${seconds ? `?start=${seconds}` : ""}`;
  }

  // Vimeo: the page is vimeo.com/<id>, the player is player.vimeo.com/video/<id>.
  const vimeoId = host === "vimeo.com" ? /^\/(\d+)$/.exec(path)?.[1] : "";
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  // Claude artifacts: the share link is a page on claude.ai, and the /embed form
  // on claude.site is the one meant for framing. Neither can be framed from our
  // domain today — see CLAUDE_HOST below and the block's own comment — so this
  // rewrite is only the half of the job a URL can do.
  if (host === "claude.ai" || host === "claude.site") {
    const id = /^\/public\/artifacts\/([0-9a-f-]{36})(?:\/embed)?$/i.exec(
      path,
    )?.[1];
    if (id) return `https://claude.site/public/artifacts/${id}/embed`;
  }

  return null;
}

/** Only an absolute http(s) URL can be framed. Anything else — a bare domain, a
 *  half-typed address, a `javascript:` URL — is treated as "not filled in yet"
 *  and draws the placeholder, so a slide never carries a dead frame. */
function frameUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return embedUrl(parsed) ?? parsed.href;
  } catch {
    return "";
  }
}

/** Whether a URL is a Claude artifact — the one refusal common enough here to
 *  be worth naming in the editor rather than leaving as a blank frame. */
function isClaudeArtifact(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, "");
    return host === "claude.ai" || host === "claude.site";
  } catch {
    return false;
  }
}

/**
 * The markup of an uploaded page, once it has been read back out of storage.
 *
 * `undefined` while it is still being fetched, `""` if it could not be — which
 * the frame draws as its placeholder, the same as an empty URL. A slide showing
 * nothing is a slide the teacher can see is wrong; a slide showing an error
 * message from us is one the room reads.
 */
function useHostedPage(path: string | undefined): {
  html: string | undefined;
  error: string;
} {
  // Keyed by the path it was read for, rather than cleared when the path
  // changes: a stale result is then simply one that doesn't match, which needs
  // no reset pass and can't paint the previous page over the current one.
  const [loaded, setLoaded] = useState<{
    path: string;
    html: string;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!path) return;
    let current = true;
    fetchLessonPage(path)
      .then((html) => {
        if (current) setLoaded({ path, html, error: "" });
      })
      .catch((e: unknown) => {
        if (!current) return;
        const error = e instanceof Error ? e.message : "Couldn't load the page.";
        setLoaded({ path, html: "", error });
      });
    return () => {
      current = false;
    };
  }, [path]);

  const fresh = path && loaded?.path === path ? loaded : null;
  return { html: fresh?.html, error: fresh?.error ?? "" };
}

/**
 * The iframe itself, sized by its parent.
 *
 * `allow="clipboard-write"` and `allowFullScreen` are what an interactive page
 * actually asks for — a copy button, a full-screen toggle. Nothing else is
 * granted: no camera, no microphone, no payment.
 *
 * Uploaded pages are sandboxed, third-party URLs are not, and the asymmetry is
 * load-bearing. A `srcdoc` document inherits the origin of the page embedding it
 * — ours — so without `sandbox` an uploaded script would be running inside the
 * Studio's own origin, with its session. Sandboxing without `allow-same-origin`
 * puts it in an opaque origin instead: it still runs, submits and opens links,
 * and can reach nothing of ours. A YouTube player, by contrast, needs its own
 * origin to work at all, and it isn't ours to lock down.
 */
const HOSTED_SANDBOX = "allow-scripts allow-forms allow-popups allow-modals";

function Frame({
  src,
  html,
  title,
}: {
  /** A third-party page, framed by address. */
  src?: string;
  /** A page of ours, framed as markup — see `useHostedPage`. */
  html?: string;
  title: string;
}) {
  return (
    <iframe
      src={src}
      srcDoc={html}
      title={title}
      className="h-full w-full border-0"
      allow="clipboard-write"
      allowFullScreen
      sandbox={html === undefined ? undefined : HOSTED_SANDBOX}
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

/** The frame's box: the ratio, the border, and whatever fills it. Shared by the
 *  View and the Editor so the studio shows the slide's own proportions. */
function FrameBox({
  ratio,
  children,
  className,
}: {
  ratio: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-muted/20",
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      {children}
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <GlobeIcon className="size-8" />
    </div>
  );
}

function View({ block }: { block: EmbedBlock }) {
  const { html } = useHostedPage(block.path);
  const title = block.title || block.label || "Embedded page";

  // An uploaded page wins over the URL: uploading is how a teacher repairs a URL
  // that turned out to refuse framing, and the repair has to be what shows.
  const url = block.path ? "" : frameUrl(block.url ?? "");

  const frame = block.path ? (
    // `undefined` is still loading — an empty frame for the moment it takes,
    // rather than a placeholder that flashes on every slide change.
    html ? (
      <Frame html={html} title={title} />
    ) : html === undefined ? (
      <div className="h-full w-full" />
    ) : (
      <Placeholder />
    )
  ) : url ? (
    <Frame src={url} title={title} />
  ) : (
    <Placeholder />
  );

  // Full-bleed: SlideView lifts this block out of the flow and hands it a
  // full-size positioned container, exactly as it does a wallpaper image. No
  // ratio here — the stage is the ratio.
  if (block.fill) {
    return (
      <div className="h-full w-full overflow-hidden bg-background">{frame}</div>
    );
  }

  return (
    <figure className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <FrameBox ratio={EMBED_ASPECTS[block.aspect ?? "16:9"].ratio}>
        {frame}
      </FrameBox>
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
  block: EmbedBlock;
  onChange: (b: EmbedBlock) => void;
}) {
  // The preview lags the URL field on purpose. An iframe reloads whenever its
  // `src` changes, so previewing every keystroke would fire a request per
  // character at whatever is being embedded; committing on blur (or Enter) loads
  // it once, when the teacher has finished typing.
  const [typed, setTyped] = useState(() => frameUrl(block.url ?? ""));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const aspect = block.aspect ?? "16:9";

  const hosted = Boolean(block.path);
  const { html, error: pageError } = useHostedPage(block.path);
  const claudeUrl = !hosted && isClaudeArtifact(block.url ?? "");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onChange({ ...block, path: await uploadLessonPage(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <input
        value={block.url ?? ""}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        onBlur={(e) => setTyped(frameUrl(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") setTyped(frameUrl(e.currentTarget.value));
        }}
        placeholder="https://… (a YouTube or Vimeo link, a map, any page)"
        className={cn(
          "w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30",
          // Still editable while a page is uploaded — it is the address the page
          // came from, and worth keeping — but it is no longer what is shown.
          hosted && "text-muted-foreground line-through decoration-1",
        )}
      />

      <input
        ref={inputRef}
        type="file"
        accept="text/html,.html,.htm"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <FrameBox
        // A full-slide embed has no ratio of its own; 16:9 is the stage it will
        // be shown on, which is the honest thing to preview it at.
        ratio={EMBED_ASPECTS[block.fill ? "16:9" : aspect].ratio}
        className="relative rounded-lg"
      >
        {hosted ? (
          html ? (
            <Frame html={html} title={block.title || "Embedded page"} />
          ) : (
            <Placeholder />
          )
        ) : typed ? (
          <Frame src={typed} title={block.title || "Embedded page"} />
        ) : (
          <Placeholder />
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            Uploading…
          </span>
        )}
      </FrameBox>

      {/* The one refusal worth explaining rather than leaving as a blank frame:
          it is the block's most likely use, and the fix is one button away. */}
      {claudeUrl && (
        <p className="text-xs text-muted-foreground">
          Claude only allows artifacts to be framed on its own site, so this URL
          will show nothing here.{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-foreground underline"
          >
            Upload the artifact's HTML
          </button>{" "}
          and we'll host it instead.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
        {(Object.keys(EMBED_ASPECTS) as Aspect[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, aspect: value })}
            disabled={block.fill === true}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
              aspect === value && !block.fill
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent",
              block.fill && "opacity-40",
            )}
          >
            {EMBED_ASPECTS[value].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...block, fill: block.fill ? undefined : true })
          }
          title="Take the whole slide, edge to edge"
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
            block.fill
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          Full slide
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {hosted ? (
            <RefreshCwIcon className="size-3.5" />
          ) : (
            <UploadIcon className="size-3.5" />
          )}
          {hosted ? "Replace page" : "Upload a page (.html)"}
        </button>
        {hosted && (
          <button
            type="button"
            onClick={() => onChange({ ...block, path: undefined })}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2Icon className="size-3.5" />
            Remove page
          </button>
        )}
        {!hosted && typed && typed !== (block.url ?? "").trim() && (
          // Only when the frame shows something other than what was typed —
          // otherwise it is the URL back at you, which says nothing.
          <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
            Framing {typed}
          </span>
        )}
      </div>

      {(error || pageError) && (
        <p className="text-xs text-destructive">{error || pageError}</p>
      )}

      <input
        value={block.title ?? ""}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
        placeholder="Frame title (for accessibility)"
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

export const embedBlock: BlockDefinition<EmbedBlock> = {
  meta: {
    type: "embed",
    label: "Embed",
    hint: "Frame a live page — a video, a map, an artifact",
    icon: GlobeIcon,
  },
  create: () => ({ type: "embed", url: "" }),
  View,
  Editor,
};
