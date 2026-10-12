import * as React from "react";
import { CheckIcon, SparklesIcon } from "lucide-react";

import { SideSheet } from "@/components/side-sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BLOCK_REGISTRY } from "@/features/blocks";
import {
  splitTitle,
  wrapHeadline,
} from "@/features/homepage/lib/class-title";
import type { CourseLesson } from "@/features/groups/data/class-plan";
import { fromDateKey } from "@/features/groups/data/groups";
import { cn } from "@/lib/utils";

const TitleCover = BLOCK_REGISTRY.title.View;

const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

/**
 * The group's course as the lesson library's module sheet lists it — cover,
 * name, unit, one row each — for picking what a class is for.
 *
 * The suggested lesson is badged, and every lesson already taught says when, so
 * "where are we?" is answered by the list itself rather than by memory.
 *
 * Imported lazily by the group page: the covers pull in the block registry,
 * which is a large part of the bundle and only needed once the sheet opens.
 */
export default function GroupLessonSheet({
  open,
  onOpenChange,
  groupName,
  lessons,
  value,
  suggestedId,
  taughtOn,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  lessons: CourseLesson[];
  /** The lesson currently picked for the class. */
  value: string | null;
  suggestedId: string | null;
  /** lessonId → the first day it was taught. */
  taughtOn: Map<string, string>;
  onChoose: (lessonId: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? lessons.filter((lesson) =>
        `${lesson.title} ${lesson.unit}`.toLowerCase().includes(needle),
      )
    : lessons;

  const modules = [...new Set(lessons.map((lesson) => lesson.module))].filter(
    Boolean,
  );

  // The picked lesson is the one worth seeing on open; in a module of twenty it
  // can be well below the fold.
  const selectedRef = React.useCallback((node: HTMLButtonElement | null) => {
    node?.parentElement?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title={modules.length === 1 ? modules[0] : `Lessons · ${groupName}`}
      description={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`}
      bodyClassName="space-y-2"
    >
      {lessons.length > 8 && (
        <Input
          placeholder="Filter lessons..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-1"
        />
      )}

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {lessons.length === 0
            ? "This group has no lessons to pick from yet."
            : "No lessons match."}
        </p>
      )}

      {visible.map((lesson) => {
        const { label, name } = splitTitle(lesson.title);
        const selected = lesson.lessonId === value;
        const taught = taughtOn.get(lesson.lessonId);

        // The cover renders headings, which a <button> may not contain — so
        // the button is laid over the row rather than wrapped around it.
        return (
          <div
            key={lesson.lessonId}
            className={cn(
              "relative flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 shadow-xs transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-accent",
              selected && "border-primary/50 bg-primary/10 hover:bg-primary/15",
            )}
          >
            <button
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-pressed={selected}
              aria-label={`${lesson.title}${
                lesson.lessonId === suggestedId ? " (suggested)" : ""
              }${taught ? `, taught ${dayFormat.format(fromDateKey(taught))}` : ""}`}
              onClick={() => {
                onChoose(lesson.lessonId);
                onOpenChange(false);
                setQuery("");
              }}
              className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none"
            />
            <span
              className={cn(
                "block w-24 shrink-0 overflow-hidden rounded-lg",
                taught && !selected && "opacity-60",
              )}
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
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium tracking-tight">
                {label || name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {taught
                  ? `Taught ${dayFormat.format(fromDateKey(taught))}`
                  : lesson.unit || "—"}
              </span>
              {lesson.lessonId === suggestedId && (
                <Badge className="mt-1 gap-1 rounded-full px-1.5 py-0 text-[0.6875rem]">
                  <SparklesIcon className="size-3" />
                  Suggested
                </Badge>
              )}
            </span>

            {selected && (
              <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
            )}
          </div>
        );
      })}
    </SideSheet>
  );
}
