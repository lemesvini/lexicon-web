import { Link } from "@tanstack/react-router";
import { PlayIcon, TabletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOCK_REGISTRY } from "@/features/blocks";
import type { ClassRow } from "@/features/homepage/data/classes";
import { cn } from "@/lib/utils";

/**
 * The cover is the presenter's own title block, not a picture of one.
 *
 * That block sizes itself entirely in container-query units (see
 * @/features/blocks/title), so the same component that fills a projector draws
 * a 288px card with the type in the same proportions. Rendering a lookalike
 * here would be a second cover to keep in step with the first.
 */
const TitleCover = BLOCK_REGISTRY.title.View;

/**
 * How many grammar-focus tags a card shows before it starts counting.
 *
 * One, and a count for the rest: the tags are what the class is *about*, which
 * is a glance-level question, and the first one answers it. A row of them turns
 * the bottom of every card into a paragraph to read.
 */
const MAX_TAGS = 1;

/**
 * Splits `"[Lesson One] Nice to meet you!"` into the lesson's label and its
 * name. Both halves are optional: a title with no bracket is all name, which is
 * what an older lesson or a file opened from disk will be.
 */
export function splitTitle(title: string): { label: string; name: string } {
  const match = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(title);
  if (!match) return { label: "", name: title };
  return { label: match[1].trim(), name: match[2].trim() || title };
}

/**
 * Breaks a headline across two or three lines of roughly equal length.
 *
 * The title block sizes its headline to the longest line it is given and keeps
 * the author's line breaks — which is right on a slide, where someone decided
 * where it wraps, and wrong here, where the string came out of a database
 * column as one long line and would be set tiny to fit. So the card picks the
 * breaks the author never got to.
 */
export function wrapHeadline(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return text;

  const lines = Math.min(3, Math.max(2, Math.ceil(text.length / 14)));
  const target = Math.ceil(text.length / lines);

  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length > target && out.length < lines - 1) {
      out.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  out.push(line);
  return out.join("\n");
}

/**
 * One launchable class as a tile: its cover, what it is, and the two ways to
 * start it.
 *
 * The cover doubles as the Present link. A class is launched far more often
 * than it is inspected, and the biggest thing on the card should be the thing
 * you came to press.
 */
export function ClassCard({
  row,
  className,
}: {
  row: ClassRow;
  className?: string;
}) {
  const { label, name } = splitTitle(row.title);
  const meta = [row.module, row.unit].filter(Boolean).join(" • ");
  const tags = row.grammarFocus.slice(0, MAX_TAGS);
  const extra = row.grammarFocus.length - tags.length;

  return (
    <article className={cn("flex w-56 shrink-0 flex-col gap-2.5", className)}>
      <Link
        to="/present/$lessonId"
        params={{ lessonId: row.id }}
        aria-label={`Present ${row.title}`}
        className="block overflow-hidden rounded-xl shadow-sm transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <TitleCover
          audience="student"
          block={{
            type: "title",
            eyebrow: label || undefined,
            title: wrapHeadline(name),
            color: "jade",
          }}
        />
      </Link>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium tracking-tight">
              {label || name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {meta || "—"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-full text-primary"
              asChild
            >
              <Link
                to="/control/$lessonId"
                params={{ lessonId: row.id }}
                aria-label={`Control ${row.title}`}
              >
                <TabletIcon />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-full text-primary"
              asChild
            >
              <Link
                to="/present/$lessonId"
                params={{ lessonId: row.id }}
                aria-label={`Present ${row.title}`}
              >
                <PlayIcon />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {row.source === "local" && (
            <Badge
              variant="outline"
              className="rounded-full px-1.5 py-0 text-[0.6875rem] text-muted-foreground"
            >
              Local file
            </Badge>
          )}
          {tags.map((tag) => (
            <Badge
              key={tag}
              // `shrink` beats the badge's own `shrink-0`: a grammar focus can
              // be a whole sentence ("Review: To Be, Present Simple, …"), and
              // one that won't shrink pushes the count off the card.
              className="min-w-0 shrink rounded-full border-transparent bg-accent px-1.5 py-0 text-[0.6875rem] text-accent-foreground"
            >
              <span className="truncate">{tag}</span>
            </Badge>
          ))}
          {extra > 0 && (
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
              {extra}+
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
