import { Link } from "@tanstack/react-router";
import {
  CheckCheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlayIcon,
  SparklesIcon,
  TabletIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GroupCard, GroupCardBody } from "@/features/groups/components/group-card";
import type { GroupRow } from "@/features/groups/data/groups";
import { splitTitle } from "@/features/homepage/lib/class-title";

/** The name the rest of the app shows for a lesson: "Lesson One" out of
 *  "[Lesson One] Nice to meet you!". */
function lessonName(title: string): string {
  const { label, name } = splitTitle(title);
  return label || name;
}

/** Why the card shows the lesson it does. */
export type LessonSource =
  /** The suggested next lesson, on a class not yet recorded. */
  | "suggested"
  /** Picked by hand for a class not yet recorded. */
  | "picked"
  /** What a recorded class was saved as. */
  | "recorded"
  /** A recorded class's lesson, changed and not saved yet. */
  | "changed";

const SOURCES = {
  suggested: { label: "Suggested", icon: SparklesIcon },
  picked: { label: "Picked for this class", icon: PencilIcon },
  recorded: { label: "Recorded for this class", icon: CheckCheckIcon },
  changed: { label: "Changed · save to keep it", icon: PencilIcon },
} as const;

/**
 * What the class on the page is for, and the two ways into it.
 *
 * The name is the control: pressing it opens the group's course in a side sheet,
 * the same one the lesson library opens a module into, with the suggested lesson
 * badged and the taught ones dated. Nothing is saved by picking — the lesson is
 * part of the class, and goes in with the register when it is saved.
 *
 * Both links carry `groupId`, so what opens is THIS group's copy — advanced
 * context included — rather than the lesson every other group gets.
 */
export function GroupLessonCard({
  group,
  lessonId,
  title,
  source,
  detail,
  disabled,
  onPick,
}: {
  group: GroupRow;
  lessonId: string | null;
  title: string;
  source: LessonSource;
  /** One more fact after the source — "after Lesson Four", say. */
  detail?: string;
  disabled?: boolean;
  onPick: () => void;
}) {
  const heading = lessonName(title);
  const { label, icon: SourceIcon } = SOURCES[source];

  return (
    <GroupCard title="Lesson">
      <GroupCardBody className="flex flex-1 flex-col p-4">
        <section className="flex flex-1 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/15 bg-primary/10 p-4 text-primary shadow-sm">
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            aria-haspopup="dialog"
            className="group min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none"
          >
            <h3 className="flex items-center gap-2 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              <span className="line-clamp-2 break-words">
                {lessonId ? heading : "Pick a lesson"}
              </span>
              <ChevronDownIcon className="size-6 shrink-0 opacity-60 transition-transform group-hover:translate-y-0.5" />
            </h3>
            {lessonId && (
              <p className="flex items-center gap-1.5 truncate text-sm opacity-80">
                <SourceIcon className="size-3.5 shrink-0" />
                {[label, detail].filter(Boolean).join(" · ")}
              </p>
            )}
          </button>

          {/* Control is the teacher's tablet, Present is what goes on the
              wall. Gone with no lesson set: there is nothing to put on a
              screen. */}
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
