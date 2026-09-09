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
// There are three ways to fill the frame, and each later one exists because of a
// wall the one before it hits. A URL is the ordinary case. But a publisher may
// refuse to be framed at all (`X-Frame-Options`, `frame-ancestors`), and Claude
// artifacts do exactly that — their embed URL names Anthropic's own domains and
// nobody else's, so pointing at one from here shows "refused to connect"
// whatever we write. For those, the page's HTML is uploaded and we host it:
// `block.path`.
//
// And some things are published with no framable address at all. X/Twitter,
// Instagram and TikTok hand out a *snippet* instead — a `<blockquote>` plus a
// `<script>` that turns it into the card — which is markup to run, not a page to
// point at. That is `block.html`. The script cannot run for us (see
// `snippetSource`), so the snippet is read rather than run: the id comes out of
// the markup and the publisher's own embed page is framed instead.

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

/** Written in pieces so the literal characters never appear in this module: a
 *  bundler that ever inlines this file into a `<script>` would otherwise see the
 *  tag close here rather than in the document we are building. */
const CLOSE_SCRIPT = "</" + "script>";

/**
 * A pasted embed snippet, wrapped in the smallest document that can run it.
 *
 * This is the *fallback*, not the main road — see `snippetSource` for why. The
 * document around the snippet stays out of the way: no styling of its own beyond
 * a transparent background, centring, and killing the margins a card should not
 * inherit. `<base target="_blank">` because a link inside a sandboxed frame with
 * nowhere to go silently does nothing; opening it in a tab is what a teacher
 * clicking a post expects.
 *
 * The trailing script is the height reporter: the document measures itself and
 * posts the number up, and `SnippetFrame` follows it. The interval is the
 * backstop for the resizes a `ResizeObserver` on `body` misses (an image inside
 * the card loading late, a font swapping in).
 */
function snippetDocument(html: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { display: flex; justify-content: center; align-items: flex-start; }
  body > * { max-width: 100%; }
  blockquote { margin: 0; }
</style></head>
<body>${html}
<script>
(function () {
  var last = -1;
  function send() {
    var b = document.body;
    var h = Math.ceil(
      Math.max(b.scrollHeight, b.getBoundingClientRect().height)
    );
    if (h && h !== last) {
      last = h;
      parent.postMessage({ source: "lexicon-embed", height: h }, "*");
    }
  }
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
  addEventListener("load", send);
  setInterval(send, 500);
  send();
})();
${CLOSE_SCRIPT}
</body></html>`;
}

/** A snippet we could not resolve runs somebody else's script, so it gets the
 *  same treatment as an uploaded page — an opaque origin, nothing of ours
 *  reachable — plus opening a post in a real tab. */
const SNIPPET_SANDBOX =
  "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals";

/** Where a frame sized by its content starts, and never goes below: enough for a
 *  card to paint into before it has said how tall it really is. */
const SNIPPET_MIN_HEIGHT = 220;

type SnippetSource =
  /** The publisher's own frameable page, at its own origin. */
  | {
      kind: "url";
      src: string;
      height: "auto" | number;
      /** The width the card is drawn at. A social embed is a column with a
       *  natural width — a tweet is 550px — and left to a full-width frame it
       *  lays itself out against the left edge of it, which reads as crooked on
       *  a slide. Capping the frame at the card's own width and centring the
       *  frame puts the card in the middle, where a wider frame cannot. */
      maxWidth?: number;
      /** Where the post lives, for when the frame does not come up. */
      link?: string;
    }
  /** The snippet as written, in a document of ours. */
  | { kind: "doc" };

/** `&amp;` in an attribute is markup, not the address. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * Reading a pasted snippet back into the address it stands for.
 *
 * The naive thing — drop the snippet in a frame and let its `<script>` run —
 * does not work for the case the field exists for. X's `widgets.js` replaces the
 * blockquote with an iframe of its own, and it needs its own origin to do it;
 * sandboxed into an opaque origin it gives up and leaves the bare quote on the
 * slide, which is what you see if you skip this function. Un-sandboxing is not
 * the answer either: a `srcdoc` document runs in *our* origin, so that trades a
 * blank card for pasted script reading a student's session.
 *
 * The way out is that the snippet is not the only thing the publisher offers. It
 * is a wrapper around an id, and behind it there is a real page built to be
 * framed — `platform.twitter.com/embed/Tweet.html?id=…` is what `widgets.js`
 * would have created anyway. So: read the id out of the markup and go there
 * directly, at the publisher's origin, where their script is already at home and
 * ours is not involved at all.
 *
 * Anything unrecognised falls back to the document — a snippet that is already
 * just an `<iframe>` (CodePen, Spotify, a map) is handled first and never needs
 * either path.
 */
/**
 * The permalinks a social card can be rebuilt from.
 *
 * They are read out of a pasted snippet — the blockquote carries the link at its
 * foot — but a teacher who simply copies the address bar on X has handed us the
 * same thing with less around it. So the patterns are shared: `isSocialPost`
 * asks whether a plain URL is one of these, and a URL that is gets the card
 * treatment rather than being framed as a page, which X refuses anyway.
 */
const TWEET_URL = /(?:twitter|x)\.com\/[^/"'\s]+\/status(?:es)?\/(\d+)/i;
const INSTAGRAM_URL = /instagram\.com\/(p|reel|reels|tv)\/([\w-]+)/i;
const TIKTOK_URL = /tiktok\.com\/@[^/"'\s]+\/video\/(\d+)/i;

/** Whether a plain address is a post we can draw as a card. */
function isSocialPost(url: string): boolean {
  const value = url.trim();
  return (
    TWEET_URL.test(value) ||
    INSTAGRAM_URL.test(value) ||
    TIKTOK_URL.test(value)
  );
}

function snippetSource(html: string, dark: boolean): SnippetSource {
  // Already an address: most publishers outside social hand out a bare iframe,
  // and its `src` is exactly what the `url` field would have taken.
  const iframe = /<iframe\b[^>]*>/i.exec(html)?.[0];
  const iframeSrc = iframe && /\bsrc=["']([^"']+)["']/i.exec(iframe)?.[1];
  if (iframeSrc && /^https?:\/\//i.test(iframeSrc)) {
    // Their own height attribute, when they set one — a cross-origin page
    // cannot be measured from here, and it is the number they chose.
    const stated = Number(/\bheight=["']?(\d{2,4})/i.exec(iframe)?.[1]);
    const wide = Number(/\bwidth=["']?(\d{2,4})/i.exec(iframe)?.[1]);
    return {
      kind: "url",
      src: decodeEntities(iframeSrc),
      height: Number.isFinite(stated) && stated > 0 ? stated : 480,
      maxWidth: Number.isFinite(wide) && wide > 0 ? wide : undefined,
    };
  }

  // X / Twitter. The status id is in the permalink at the foot of the quote.
  const tweetId = TWEET_URL.exec(html)?.[1];
  if (tweetId) {
    const params = new URLSearchParams({
      id: tweetId,
      theme: dark ? "dark" : "light",
      dnt: "true",
      // The frame reports its height only when it knows a parent is listening
      // for it, and this is how the official script says so.
      widgetsVersion: "2615f7e52b7e0:1702314776716",
    });
    return {
      kind: "url",
      src: `https://platform.twitter.com/embed/Tweet.html?${params}`,
      height: "auto",
      maxWidth: 550,
      link: `https://x.com/i/status/${tweetId}`,
    };
  }

  // Instagram. `/embed/captioned/` is the post with its caption, which is the
  // half a language teacher is usually after.
  const insta = INSTAGRAM_URL.exec(html);
  if (insta) {
    const kind = insta[1].toLowerCase() === "reels" ? "reel" : insta[1];
    return {
      kind: "url",
      src: `https://www.instagram.com/${kind}/${insta[2]}/embed/captioned/`,
      height: "auto",
      maxWidth: 540,
      link: `https://www.instagram.com/${kind}/${insta[2]}/`,
    };
  }

  // TikTok. The id is on the blockquote as an attribute and in the permalink.
  const tiktokId =
    /\bdata-video-id=["'](\d+)["']/i.exec(html)?.[1] ??
    TIKTOK_URL.exec(html)?.[1];
  if (tiktokId) {
    return {
      kind: "url",
      src: `https://www.tiktok.com/embed/v2/${tiktokId}`,
      // TikTok's player is a phone screen and does not report a height.
      height: 740,
      maxWidth: 605,
    };
  }

  return { kind: "doc" };
}

/**
 * The size a framed card says it is, in the three dialects that matter.
 *
 * Ours is the one `snippetDocument` speaks. The other two are the publishers':
 * X posts `{"twttr.embed": {method: "twttr.private.resize", params: [{width,
 * height}]}}`
 * and Instagram posts a JSON *string* with `type: "MEASURE"`. Every one of them
 * is matched by `contentWindow` first — a slide may carry more than one card,
 * and a message says nothing else about which frame it came from.
 */
type ReportedSize = { height: number; width?: number };

function reportedSize(data: unknown): ReportedSize | null {
  if (typeof data === "string") {
    if (!data.includes("MEASURE")) return null;
    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        details?: { height?: number; width?: number };
      };
      if (parsed?.type !== "MEASURE") return null;
      const h = parsed.details?.height;
      if (typeof h !== "number" || !Number.isFinite(h)) return null;
      return { height: h, width: parsed.details?.width };
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;

  const ours = data as { source?: string; height?: number };
  if (ours.source === "lexicon-embed" && Number.isFinite(ours.height))
    return { height: ours.height as number };

  const embed = (data as Record<string, unknown>)["twttr.embed"] as
    | { method?: string; params?: { height?: number; width?: number }[] }
    | undefined;
  if (embed?.method === "twttr.private.resize") {
    const size = embed.params?.[0];
    if (typeof size?.height === "number" && Number.isFinite(size.height))
      return { height: size.height, width: size.width };
  }
  return null;
}

/** Whether the app is currently in dark mode, for the publishers that let us ask
 *  for a matching card. Read off the root class ThemeProvider sets, and watched,
 *  because a teacher flipping the theme should not leave a white tweet on a dark
 *  slide until the page reloads. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() =>
      setDark(root.classList.contains("dark")),
    );
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * The frame for a pasted snippet, sized by what is inside it.
 *
 * Every other embed is a ratio (see `EMBED_ASPECTS`); this one usually cannot
 * be. A tweet in a 16:9 box is a card with a field of empty either side of it,
 * and a thread in the same box is a scrollbar. So where the card reports its
 * height, the frame takes it.
 */
function SnippetFrame({
  code,
  title,
  fill,
}: {
  /** An embed snippet, or the plain address of a post — `snippetSource` reads
   *  the permalink out of either. */
  code: string;
  title: string;
  /** Full-slide: the stage is the height, so ignore what the card reports. */
  fill?: boolean;
}) {
  const dark = useDarkMode();
  const ref = useRef<HTMLIFrameElement>(null);
  const source = snippetSource(code, dark);
  const stated = source.kind === "url" ? source.height : "auto";
  const [height, setHeight] = useState(SNIPPET_MIN_HEIGHT);
  /** A card that says nothing for this long is a card that is not coming. */
  const [silent, setSilent] = useState(false);
  const [reportedWidth, setReportedWidth] = useState(0);
  const link = source.kind === "url" ? source.link : undefined;

  useEffect(() => {
    if (stated !== "auto") return;
    function onMessage(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return;
      const reported = reportedSize(e.data);
      if (reported === null) return;
      setHeight(Math.max(SNIPPET_MIN_HEIGHT, Math.ceil(reported.height)));
      if (reported.width) setReportedWidth(Math.ceil(reported.width));
      setSilent(false);
    }
    window.addEventListener("message", onMessage);
    // A tracker blocker — a browser's own, or an extension — takes the frame
    // out without an error anyone can catch, and an empty box on a slide tells
    // the room nothing. Waiting for the card's own first word is the only
    // signal we get, so a long enough silence is read as "blocked" and says so.
    const timer = window.setTimeout(() => setSilent(true), 6000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [stated, code, dark]);

  // A card that says how wide it is is believed over the number we guessed —
  // X reports its width alongside its height, and a thread or a quoted post is
  // not always the standard 550.
  const width = reportedWidth ?? (source.kind === "url" ? source.maxWidth : 0);

  const shared = {
    title,
    // `mx-auto` with a cap is the centring: the frame is as wide as the card
    // wants and no wider, so the card cannot sit against one edge of it.
    className: cn("mx-auto w-full border-0", fill && "h-full"),
    style: fill
      ? undefined
      : {
          height: stated === "auto" ? height : stated,
          maxWidth: width ? `${width}px` : undefined,
        },
    allow: "clipboard-write",
    allowFullScreen: true,
    referrerPolicy: "no-referrer-when-downgrade" as const,
  };

  // A publisher's page is at a publisher's origin: cross-origin already, with
  // nothing of ours in reach, and sandboxing it only breaks the card. A snippet
  // we could not read stays in a document of ours, and that one is locked down.
  const frame =
    source.kind === "url" ? (
      <iframe ref={ref} src={source.src} {...shared} />
    ) : (
      <iframe
        ref={ref}
        srcDoc={snippetDocument(code)}
        sandbox={SNIPPET_SANDBOX}
        {...shared}
      />
    );

  if (!silent || fill) return frame;

  return (
    <div className="space-y-1.5">
      {frame}
      <p className="text-center text-xs text-muted-foreground">
        This card hasn't loaded. A tracker blocker — the browser's own or an
        extension's — will do that to an embed silently; try another browser
        before the lesson
        {link ? (
          <>
            , or{" "}
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline"
            >
              open the post
            </a>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

/** Whether what was typed into the URL field is in fact a pasted snippet. A
 *  teacher copies an embed code and puts it where the address goes, which is the
 *  reasonable thing to do; the field takes it and files it in the right place. */
function looksLikeHtml(value: string): boolean {
  const v = value.trim();
  return v.startsWith("<") && /<\/?[a-z][\s\S]*>/i.test(v);
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
  const snippet = block.html?.trim() ?? "";
  const raw = (block.url ?? "").trim();
  // A pasted snippet, or an address that is a post rather than a page: X's own
  // status URL cannot be framed, and the card is what the teacher meant by it.
  const card = snippet || (!block.path && isSocialPost(raw) ? raw : "");
  const { html } = useHostedPage(card ? undefined : block.path);
  const title = block.title || block.label || "Embedded page";

  // An uploaded page wins over the URL: uploading is how a teacher repairs a URL
  // that turned out to refuse framing, and the repair has to be what shows. A
  // card wins over both for the same reason.
  const url = card || block.path ? "" : frameUrl(raw);

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
      <div className="h-full w-full overflow-hidden bg-background">
        {card ? <SnippetFrame code={card} title={title} fill /> : frame}
      </div>
    );
  }

  return (
    <figure className="space-y-3">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      {card ? (
        // No FrameBox: a card brings its own height, and a ratio around it
        // would be the empty margin the card was drawn to avoid.
        <SnippetFrame code={card} title={title} />
      ) : (
        <FrameBox ratio={EMBED_ASPECTS[block.aspect ?? "16:9"].ratio}>
          {frame}
        </FrameBox>
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

  const snippet = block.html?.trim() ?? "";
  const raw = (block.url ?? "").trim();
  const card = snippet || (!block.path && isSocialPost(raw) ? raw : "");
  const hosted = Boolean(block.path) && !snippet;
  const { html, error: pageError } = useHostedPage(
    hosted ? block.path : undefined,
  );
  const claudeUrl = !hosted && !card && isClaudeArtifact(raw);

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
        onChange={(e) => {
          const value = e.target.value;
          // An embed code pasted where the address goes is filed as what it is,
          // rather than saved as a URL that could never load.
          if (looksLikeHtml(value)) onChange({ ...block, html: value });
          else onChange({ ...block, url: value });
        }}
        onBlur={(e) => setTyped(frameUrl(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") setTyped(frameUrl(e.currentTarget.value));
        }}
        placeholder="https://… (a YouTube or Vimeo link, an X post, a map, any page)"
        className={cn(
          "w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30",
          // Still editable while a page is uploaded — it is the address the page
          // came from, and worth keeping — but it is no longer what is shown.
          (hosted || snippet) && "text-muted-foreground line-through decoration-1",
        )}
      />

      {/* The embed code itself. Kept next to the URL rather than behind a mode
          switch: which of the two a publisher gives you is their choice, not a
          decision the teacher makes before they paste. */}
      <AutoTextarea
        value={block.html ?? ""}
        onValueChange={(value) => onChange({ ...block, html: value })}
        placeholder="…or paste an embed code (X, Instagram, TikTok, CodePen)"
        className="max-h-32 overflow-auto font-mono text-xs text-muted-foreground placeholder:font-sans"
      />

      <input
        ref={inputRef}
        type="file"
        accept="text/html,.html,.htm"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {card ? (
        // A card is previewed at its own height, the same as it renders — and
        // re-mounted per card (`key`) so an edit reloads the frame instead of
        // leaving the last one running in it.
        <div className="overflow-hidden rounded-lg border bg-muted/20">
          <SnippetFrame
            key={card}
            code={card}
            title={block.title || "Embedded page"}
          />
        </div>
      ) : (
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
      )}

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
            // A snippet measures itself, so a ratio is not one of its choices.
            disabled={block.fill === true || Boolean(card)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
              aspect === value && !block.fill && !card
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent",
              (block.fill || card) && "opacity-40",
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
        {snippet && (
          <button
            type="button"
            onClick={() => onChange({ ...block, html: undefined })}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
            Remove embed code
          </button>
        )}
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
        {!hosted && !card && typed && typed !== raw && (
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
    hint: "Frame a live page, a post or an embed code — video, map, tweet",
    icon: GlobeIcon,
  },
  create: () => ({ type: "embed", url: "" }),
  View,
  Editor,
};
