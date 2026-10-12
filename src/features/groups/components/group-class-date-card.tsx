import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GroupCard,
  GroupCardBody,
} from "@/features/groups/components/group-card";
import type { GroupClass } from "@/features/groups/data/group-classes";
import {
  formatTime,
  fromDateKey,
  today,
} from "@/features/groups/data/groups";
import { cn } from "@/lib/utils";

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

/**
 * When the class on the page happened: the date, large, and the time it
 * started.
 *
 * The date is the page's place in the group's history — moving it moves the
 * lesson panel and the register with it, onto the class recorded that day or a
 * fresh one. It is drawn as a heading rather than a field because it is the one
 * thing a teacher checks before marking anyone; the native picker sits over it,
 * invisible, so a press anywhere on the date opens it.
 *
 * The time is the class's own, not the group's: it starts as the group's usual
 * hour and is kept as whatever is saved.
 *
 * A day with more than one class gets a row of them, plus a way to start
 * another.
 */
export function GroupClassDateCard({
  classDate,
  onDateChange,
  startsAt,
  onStartsAtChange,
  classesOnDate,
  selectedClassId,
  onSelectClass,
  disabled,
}: {
  classDate: string;
  onDateChange: (classDate: string) => void;
  /** "HH:MM", or "" for no time. */
  startsAt: string;
  onStartsAtChange: (startsAt: string) => void;
  /** Classes recorded on `classDate`, earliest first. */
  classesOnDate: GroupClass[];
  /** The class being looked at, or null for a new one. */
  selectedClassId: string | null;
  onSelectClass: (classId: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const date = fromDateKey(classDate);
  const todayKey = today();
  const sameYear = date.getFullYear() === new Date().getFullYear();

  return (
    <GroupCard
      title="Class"
      action={
        selectedClassId ? (
          <Badge variant="secondary">Recorded</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Not recorded yet
          </Badge>
        )
      }
    >
      <GroupCardBody className="flex flex-1 flex-col justify-center gap-4 p-4">
        <div className="relative rounded-xl px-1 focus-within:ring-2 focus-within:ring-ring/40">
          <p className="text-sm text-muted-foreground">
            {classDate === todayKey ? "Today" : weekdayFormat.format(date)}
          </p>
          <p className="flex items-center gap-2 font-display text-4xl leading-none tracking-tight sm:text-5xl">
            {dayFormat.format(date)}
            {!sameYear && (
              <span className="text-2xl text-muted-foreground">
                {date.getFullYear()}
              </span>
            )}
          </p>
          <input
            ref={inputRef}
            type="date"
            aria-label="Class date"
            value={classDate}
            max={todayKey}
            disabled={disabled}
            onClick={(event) => {
              try {
                event.currentTarget.showPicker();
              } catch {
                // Older browsers: the focused input still takes typing.
              }
            }}
            onChange={(event) => {
              if (event.target.value) onDateChange(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="class-time">Started at</Label>
          <Input
            id="class-time"
            type="time"
            className="w-32"
            value={startsAt}
            disabled={disabled}
            onChange={(event) => onStartsAtChange(event.target.value)}
          />
        </div>

        {classesOnDate.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Classes on this day">
            {classesOnDate.map((entry) => (
              <ClassChip
                key={entry.id}
                selected={entry.id === selectedClassId}
                disabled={disabled}
                onClick={() => onSelectClass(entry.id)}
              >
                {formatTime(entry.startsAt) || "No time"}
                <span className="tabular-nums opacity-70">
                  {entry.present}/{entry.total}
                </span>
              </ClassChip>
            ))}
            <ClassChip
              selected={selectedClassId === null}
              disabled={disabled}
              onClick={() => onSelectClass(null)}
            >
              <PlusIcon className="size-3.5" />
              New class
            </ClassChip>
          </div>
        )}
      </GroupCardBody>
    </GroupCard>
  );
}

function ClassChip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60",
        selected && "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      {children}
    </button>
  );
}
