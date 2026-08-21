import * as React from "react";
import { MailIcon } from "lucide-react";
import type { EmailBlock } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { BlockDefinition } from "../types";
import { FOREST, INK, JADE, MIST, withAlpha } from "../brand";
import { Markdown } from "../markdown";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import { BlockLabelInput, NoteInput } from "../editor-ui/primitives";

// An email, drawn as the macOS Mail compose window. See `EmailBlock` in
// @/lib/lessons for why the window is drawn rather than the words alone.

type EmailTheme = NonNullable<EmailBlock["theme"]>;

type ThemeTokens = {
  label: string;
  /** The window itself. */
  surface: string;
  /** Its outer edge. */
  border: string;
  /** Hairline between the header rows. */
  rule: string;
  /** Field names — "To:", "Subject:". */
  field: string;
  /** Everything the author wrote. */
  text: string;
};

/**
 * The window treatments.
 *
 * `light` and `dark` are macOS Mail as the student would actually meet it — use
 * them when the email is the thing being read, which is most of the time. `mist`
 * and `forest` are the same window in the brand's greens, for a slide where the
 * email is a piece of the deck rather than a screenshot of the world; they pair
 * with the `title` covers of the same names.
 *
 * Flat colour rather than theme tokens, for the reason ../brand gives: which
 * theme the email is in is the author's decision about the email, not about the
 * app. A dark Mail window projected out of a teacher's light-mode studio must
 * still be a dark window, because that is the thing the class is being shown.
 */
export const EMAIL_THEMES: Record<EmailTheme, ThemeTokens> = {
  light: {
    label: "Light",
    surface: "#ffffff",
    border: "#d3d3d6",
    rule: "#e8e8ea",
    field: "#6e6e73",
    text: "#1d1d1f",
  },
  dark: {
    label: "Dark",
    surface: "#1f1f21",
    border: "#39393c",
    rule: "#313134",
    field: "#98989d",
    text: "#f2f2f7",
  },
  // The brand pair. Rules and edges are the ground colour of the *other* one at
  // low alpha rather than a sixth green: a hairline is a shade of the thing it
  // sits on, and inventing one per theme is how a palette stops being a palette.
  mist: {
    label: "Mist",
    surface: MIST,
    border: withAlpha(FOREST, 0.22),
    rule: withAlpha(FOREST, 0.14),
    field: withAlpha(FOREST, 0.65),
    text: FOREST,
  },
  forest: {
    label: "Forest",
    surface: FOREST,
    border: INK,
    rule: withAlpha(MIST, 0.14),
    field: JADE,
    text: MIST,
  },
};

/**
 * The window's treatment, defaulting to light — and falling back to it rather
 * than throwing on a theme nobody defined. There are four legal values and a
 * picker that only emits those, so a fifth one only ever arrives in
 * hand-written JSON; an email that comes out light when its author wanted dark
 * is visible in the studio's preview, whereas a crash takes the slide with it.
 */
function themeOf(block: EmailBlock): ThemeTokens {
  return EMAIL_THEMES[block.theme ?? "light"] ?? EMAIL_THEMES.light;
}

/** Close / minimise / zoom. The same three colours in every theme, the brand
 *  ones included — macOS does not re-tint them, and now that they are the only
 *  chrome left they are the whole of what says "window" rather than "box". */
const TRAFFIC_LIGHTS = ["#ff5f57", "#febc2e", "#28c840"];

/** The header rows, in the order Mail draws them. Each is optional: an email
 *  with no `cc` should be a window with no Cc line, not one with a blank one. */
const FIELDS = [
  { key: "to", name: "To:", placeholder: "recipient@example.com" },
  { key: "cc", name: "Cc:", placeholder: "(optional)" },
  { key: "subject", name: "Subject:", placeholder: "Subject line" },
  { key: "from", name: "From:", placeholder: "Sender Name – you@example.com" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** Width of the field-name gutter — set by "Subject:", the longest of them, so
 *  every value starts at the same x the way the real window's do. */
const GUTTER = "w-[4.75rem]";

/**
 * The title bar: three traffic lights, and deliberately nothing else.
 *
 * Mail's formatting toolbar and its send button both used to live here and are
 * gone for the same reason — buttons that do nothing, competing for attention
 * with the one thing on the slide anybody is meant to read. Three dots and a
 * hairline are all it takes to say "window"; everything past that was costume.
 *
 * `aria-hidden` because of it: there is nothing here to operate, and the email's
 * actual content is the header rows and the body below.
 */
function Chrome({ t }: { t: ThemeTokens }) {
  return (
    <div
      aria-hidden
      className="flex items-center gap-1.5 px-4 py-2.5"
      style={{ borderBottom: `1px solid ${t.rule}` }}
    >
      {TRAFFIC_LIGHTS.map((color) => (
        <span
          key={color}
          className="size-2.5 rounded-full"
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

/** One header row: the field name in its gutter, the value beside it. */
function HeaderRow({
  t,
  name,
  children,
}: {
  t: ThemeTokens;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-baseline gap-3 px-4 py-2"
      style={{ borderBottom: `1px solid ${t.rule}` }}
    >
      <span className={cn(GUTTER, "shrink-0 text-sm")} style={{ color: t.field }}>
        {name}
      </span>
      {children}
    </div>
  );
}

function View({ block }: { block: EmailBlock }) {
  const t = themeOf(block);

  return (
    <section className="space-y-2.5">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}

      <div
        className="overflow-hidden rounded-xl shadow-lg"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          color: t.text,
        }}
      >
        <Chrome t={t} />

        {FIELDS.map(({ key, name }) =>
          block[key] ? (
            <HeaderRow key={key} t={t} name={name}>
              <span className="min-w-0 flex-1 text-base">{block[key]}</span>
            </HeaderRow>
          ) : null,
        )}

        {/* A minimum height so a two-line note still reads as a window with a
            message in it rather than as a header strip. */}
        <div className="min-h-20 px-4 py-4 text-lg leading-relaxed">
          <Markdown text={block.body} />
        </div>
      </div>

      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: EmailBlock;
  onChange: (b: EmailBlock) => void;
}) {
  const theme = block.theme ?? "light";
  const t = themeOf(block);

  const setField = (key: FieldKey, value: string) =>
    onChange({ ...block, [key]: value });

  return (
    <div className="space-y-2">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      {/* Edited inside the window it will be projected in, like the callout's
          editor: the theme is a choice about how the email looks, so it has to
          be visible while the words are being written. */}
      <div
        className="overflow-hidden rounded-lg"
        style={
          {
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.text,
            "--email-field": t.field,
          } as React.CSSProperties
        }
      >
        <Chrome t={t} />

        {FIELDS.map(({ key, name, placeholder }) => (
          <HeaderRow key={key} t={t} name={name}>
            <input
              value={block[key] ?? ""}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
              aria-label={name}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--email-field)] placeholder:opacity-60 focus:rounded-sm focus:ring-2 focus:ring-ring/40"
              style={{ color: t.text }}
            />
          </HeaderRow>
        ))}

        <AutoTextarea
          value={block.body}
          onValueChange={(body) => onChange({ ...block, body })}
          placeholder="Write the message… blank line between paragraphs"
          aria-label="Message"
          className="px-4 py-3 text-base leading-relaxed placeholder:text-[color:var(--email-field)] placeholder:opacity-60"
          style={{ color: t.text }}
        />
      </div>

      <div className="flex items-center gap-1.5 border-t pt-2">
        {(Object.keys(EMAIL_THEMES) as EmailTheme[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...block, theme: value })}
            aria-label={EMAIL_THEMES[value].label}
            title={EMAIL_THEMES[value].label}
            style={{
              background: EMAIL_THEMES[value].surface,
              borderColor: EMAIL_THEMES[value].border,
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

export const emailBlock: BlockDefinition<EmailBlock> = {
  meta: {
    type: "email",
    label: "Email",
    hint: "Message in a Mail window",
    icon: MailIcon,
  },
  create: () => ({
    type: "email",
    theme: "light",
    to: "",
    cc: "",
    subject: "",
    from: "",
    body: "",
  }),
  View,
  Editor,
};
