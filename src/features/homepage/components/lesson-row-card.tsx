import { Link } from "@tanstack/react-router";
import { PlayIcon, TabletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BLOCK_REGISTRY } from "@/features/blocks";
import {
  splitTitle,
  wrapHeadline,
} from "@/features/homepage/components/class-card";
import type { ClassRow } from "@/features/homepage/data/classes";
import { cn } from "@/lib/utils";

const TitleCover = BLOCK_REGISTRY.title.View;

/**
 * One class as a horizontal row: a thumbnail-sized cover, its name, and the
 * two ways to start it — for a sidebar of a module's lessons, where the list
 * runs down rather than across and a 56-wide tile like {@link ClassCard}
 * would waste the width the panel actually has.
 */
export function LessonRowCard({
  row,
  className,
}: {
  row: ClassRow;
  className?: string;
}) {
  const { label, name } = splitTitle(row.title);

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 shadow-xs",
        className,
      )}
    >
      <Link
        to="/present/$lessonId"
        params={{ lessonId: row.id }}
        aria-label={`Present ${row.title}`}
        className="block w-24 shrink-0 overflow-hidden rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium tracking-tight">
          {label || name}
        </p>
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs text-muted-foreground">
            {row.unit || "—"}
          </p>
          {row.source === "local" && (
            <Badge
              variant="outline"
              className="shrink-0 rounded-full px-1.5 py-0 text-[0.6875rem] text-muted-foreground"
            >
              Local file
            </Badge>
          )}
        </div>
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
    </article>
  );
}
