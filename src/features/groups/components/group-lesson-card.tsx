import { Link } from "@tanstack/react-router";
import {
  CalendarCheckIcon,
  CheckCheckIcon,
  ListOrderedIcon,
  PlayIcon,
  SparklesIcon,
  TabletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonCombobox } from "@/components/lesson-combobox";
import { GroupCard, GroupCardBody } from "@/features/groups/components/group-card";
import {
  fromDateKey,
  today,
  type GroupRow,
} from "@/features/groups/data/groups";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

/**
 * The label out of `"[Lesson One] Nice to meet you!"`, which is the name the
 * rest of the app shows; the sentence after it is the slide's headline.
 *
 * A local copy of the dashboard's `splitTitle` rather than an import of it: that
 * one lives beside the cover renderer and pulls the whole block registry in with
 * it, which is a megabyte of bundle for a regular expression.
 */
function lessonName(title: string): string {
  const match = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(title);
  if (!match) return title;
  return match[1].trim() || match[2].trim() || title;
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** The lesson a class is for, and why it is that one. */
export type DayLesson = {
  lessonId: string | null;
  title: string;
  /**
   * recorded  the register for that day was taken for it
   * chosen    picked here for a register not yet taken
   * next      the first lesson in the plan nobody has been taught
   * planned   where the plan's projection puts it (a future day)
   * current   the group's current lesson — a group with no plan of its own
   */
  source: "recorded" | "chosen" | "next" | "planned" | "current";
  /** Blocks and slides this group's copy adds. 0 without a copy. */
  advancedCount: number;
};

const SOURCES = {
  recorded: { label: "Recorded in the register", icon: CheckCheckIcon },
  chosen: { label: "Picked for this class", icon: CalendarCheckIcon },
  next: { label: "Next in the plan", icon: ListOrderedIcon },
  planned: { label: "Expected", icon: CalendarCheckIcon },
  current: { label: "", icon: ListOrderedIcon },
} as const;

/**
 * What this group is doing on the day being looked at, and the two ways into it.
 *
 * Drawn as the module tile in the group's studio is drawn — a tinted card inside
 * the panel, its name the control that changes it — because it is the same kind
 * of thing: the one fact the panel is about, chosen from a list. The launch pair
 * is the round pair from the lesson cards on the dashboard, in the corner they
 * are in there.
 *
 * One row, no icon and no minimum height: the tile holds a name and two buttons,
 * and anything taller was empty space charged to the row beside it — the panels
 * share a height, so this one being tall made the schedule panel tall too.
 *
 * The tile is inset by the same 16px it pads its own text with, so the ring of
 * background around it reads as even on all four sides.
 *
 * Centred rather than sat on the bottom edge. The tile still grows to whatever
 * height the row settles on, and with the icon gone there is nothing above the
 * name to hold it down there — bottom-aligned, the spare space all collected in
 * one lump over the title.
 *
 * Both links carry `groupId`, so what opens is THIS group's copy — advanced
 * context included — rather than the lesson every other group gets.
 *
 * The lesson comes from the register, not from a date: what that day's register
 * was taken for, or — for a class not yet recorded — the next lesson in the
 * plan. The name is always the picker (the group's own module only), because
 * a class can do something other than what was expected, and saying so here is
 * what keeps the record and the plan honest.
 */
export function GroupLessonCard({
  group,
  classDate,
  day,
  lessons,
  busy,
  onChoose,
}: {
  group: GroupRow;
  /** The day the register is on — this card follows it, so looking back at last
   *  Tuesday shows what last Tuesday was, not what is on now. */
  classDate: string;
  /** The lesson for that day and where the answer came from — worked out by the
   *  page from the register, see `lessonForDay`. */
  day: DayLesson;
  lessons: CloudLessonSummary[];
  busy: boolean;
  /** Picks a different lesson for this day: re-files its register if it has
   *  one, or sets what the register will record when it is taken. */
  onChoose: (lessonId: string | null) => void;
}) {
  const { lessonId } = day;
  const heading = lessonName(day.title);
  const source = SOURCES[day.source];
  const SourceIcon = source.icon;

  return (
    <GroupCard
      title={classDate === today() ? "Today’s lesson" : "Lesson"}
      action={
        <Badge variant="outline" className="tabular-nums text-muted-foreground">
          {dayFormat.format(fromDateKey(classDate))}
        </Badge>
      }
    >
      <GroupCardBody className="flex flex-1 flex-col p-4">
        <section className="flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-primary/10 p-4 text-primary shadow-sm">
          {/* The name is always the control. Classes don't run to a timetable,
              so whatever the plan says, the teacher can say what this class is
              actually doing — and the register files it under that. */}
          <LessonCombobox
            lessons={lessons}
            value={lessonId}
            module={group.moduleName}
            allowNone
            noneLabel="No lesson set"
            disabled={busy}
            onChange={onChoose}
          >
            <button
              type="button"
              className="min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <h3 className="line-clamp-2 break-words font-display text-xl leading-tight tracking-tight sm:text-2xl">
                {lessonId ? heading : "Pick a lesson"}
              </h3>
              {/* Where the answer came from, so "next in the plan" and "what
                  the register says was taught" don't look like the same fact. */}
              {lessonId && (
                <p className="flex items-center gap-1.5 truncate text-sm opacity-80">
                  <SourceIcon className="size-3.5 shrink-0" />
                  {source.label || group.lessonModule}
                  {day.advancedCount > 0 && (
                    <SparklesIcon
                      className="size-3.5 shrink-0"
                      aria-label="Has advanced context"
                    />
                  )}
                </p>
              )}
            </button>
          </LessonCombobox>

          {/* Control is the teacher's tablet, Present is what goes on the
              wall. Gone entirely with no lesson set: there is nothing to put
              on a screen, and a pair of dead buttons says that worse than
              their absence does. */}
          {lessonId && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full border-primary/25 bg-background/60 text-primary"
                asChild
              >
                <Link
                  to="/control/$lessonId"
                  params={{ lessonId }}
                  search={{ groupId: group.id }}
                  aria-label={`Control ${heading} for ${group.name}`}
                >
                  <TabletIcon />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full border-primary/25 bg-background/60 text-primary"
                asChild
              >
                <Link
                  to="/present/$lessonId"
                  params={{ lessonId }}
                  search={{ groupId: group.id }}
                  aria-label={`Present ${heading} for ${group.name}`}
                >
                  <PlayIcon />
                </Link>
              </Button>
            </div>
          )}
        </section>
      </GroupCardBody>
    </GroupCard>
  );
}
