import { Link } from "@tanstack/react-router";
import {
  CalendarCheckIcon,
  CheckIcon,
  PlayIcon,
  SparklesIcon,
  TabletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupCard, GroupCardBody } from "@/features/groups/components/group-card";
import type { ScheduledClass } from "@/features/groups/data/group-lessons";
import {
  fromDateKey,
  setGroupLesson,
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
 * Two answers can appear here. A lesson dated to this day in the group's studio
 * is the plan, and is read-only: it is set where the dates are set, and two
 * places to write one fact is how they end up disagreeing. Failing that, the
 * group's current lesson is the fallback, and that one is the picker — it is a
 * pointer, and this is as good a place to move it as any.
 */
export function GroupLessonCard({
  group,
  classDate,
  planned,
  lessons,
  busy,
  run,
}: {
  group: GroupRow;
  /** The day the register is on — this card follows it, so looking back at last
   *  Tuesday shows what last Tuesday was, not what is on now. */
  classDate: string;
  /** The lesson dated to `classDate` in the group's studio, if there is one. */
  planned: ScheduledClass | null;
  lessons: CloudLessonSummary[];
  busy: boolean;
  /** The page's write runner: reloads and reports failures in one place. */
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const lessonId = planned?.lessonId ?? group.lessonId;
  const rawTitle = planned
    ? planned.title || planned.lessonId
    : group.lessonTitle;

  const heading = lessonName(rawTitle);
  const subtitle = planned ? "Planned" : group.lessonModule;

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
          {/* The name is the control, exactly as the module tile's is — and
              for the same reason it isn't one when the studio has dated a
              lesson to this day: that is the plan, and it is changed where the
              dates are. */}
          {planned ? (
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 break-words font-display text-xl leading-tight tracking-tight sm:text-2xl">
                {heading}
              </h3>
              {/* The markers ride on the subtitle now that the tile has no
                  icon row: "planned in the studio", and whether this group's
                  copy has anything of its own in it. */}
              <p className="flex items-center gap-1.5 truncate text-sm opacity-80">
                <CalendarCheckIcon className="size-3.5 shrink-0" />
                {subtitle}
                {planned.advancedCount > 0 && (
                  <SparklesIcon
                    className="size-3.5 shrink-0"
                    aria-label="Has advanced context"
                  />
                )}
              </p>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={busy}>
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <h3 className="line-clamp-2 break-words font-display text-xl leading-tight tracking-tight sm:text-2xl">
                    {heading}
                  </h3>
                  <p className="truncate text-sm opacity-80">
                    {lessonId ? subtitle : "Pick a lesson"}
                  </p>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-80 w-72 overflow-y-auto"
              >
                <DropdownMenuItem
                  onSelect={() => run(() => setGroupLesson(group.id, null))}
                >
                  No lesson set
                </DropdownMenuItem>
                {lessons.map((lesson) => (
                  <DropdownMenuItem
                    key={lesson.id}
                    onSelect={() =>
                      run(() => setGroupLesson(group.id, lesson.id))
                    }
                  >
                    {lesson.id === group.lessonId && <CheckIcon />}
                    <span className="truncate">
                      {lesson.title || lesson.id}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
