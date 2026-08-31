import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GroupCard,
  GroupCardBody,
} from "@/features/groups/components/group-card";
import { WeekdayPicker } from "@/features/groups/components/weekday-picker";
import {
  formatDays,
  formatTime,
  setGroupDays,
  setGroupTime,
  type GroupRow,
} from "@/features/groups/data/groups";

/**
 * When the group meets: the days, and the hour.
 *
 * Its own panel rather than two fields at the top of the register, because it is
 * a different kind of fact — the days and the time are true of the group every
 * week, and the register is one afternoon. It is also what the week view reads,
 * so it is worth being able to find.
 *
 * Two rows, no heading over the chips: the card is called Schedule and the chips
 * are seven days of the week, so a "Meets on" above them was a line of height
 * spent saying what the reader can already see — and the height is shared with
 * the lesson panel beside it.
 */
export function GroupScheduleCard({
  group,
  busy,
  run,
}: {
  group: GroupRow;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const time = formatTime(group.startsAt);

  return (
    <GroupCard
      title="Schedule"
      action={
        <p className="text-xs text-muted-foreground">
          {group.meetsOn.length === 0
            ? "No fixed days"
            : `${group.meetsOn.length} class${
                group.meetsOn.length === 1 ? "" : "es"
              } a week`}
        </p>
      }
    >
      <GroupCardBody className="p-4">
        {/* Named for screen readers only, for the reason above: the label is
            worth having, the line it sat on wasn't. */}
        <Label id="schedule-days-label" className="sr-only">
          Meets on
        </Label>
        {/* Saves on each toggle rather than behind a Save button: there is
            nothing to get half-right about one day. */}
        <WeekdayPicker
          value={group.meetsOn}
          disabled={busy}
          onChange={(days) => void run(() => setGroupDays(group.id, days))}
          aria-labelledby="schedule-days-label"
        />

        {/* The label beside its field rather than above it: it is one short
            value, and a stacked pair under the days read as a form. */}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="schedule-time">Starts at</Label>
          {/* On blur, not on every keystroke: a time input fires a change for
              each digit typed, and half a time is a write the column would
              reject. The days above can save per click because a click there is
              a whole answer. */}
          <Input
            id="schedule-time"
            type="time"
            className="w-32"
            disabled={busy}
            key={group.startsAt ?? ""}
            defaultValue={time}
            onBlur={(event) => {
              const next = event.target.value;
              if (next === time) return;
              void run(() => setGroupTime(group.id, next));
            }}
          />
        </div>

        {/* Only when something is missing. The days and the time are on screen
            directly above; restating them under themselves says nothing. */}
        {group.meetsOn.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            With no days set the group won’t appear on the schedule.
          </p>
        ) : (
          !time && (
            <p className="text-xs text-muted-foreground">
              No time set — {formatDays(group.meetsOn)} classes sort last on the
              schedule.
            </p>
          )
        )}
      </GroupCardBody>
    </GroupCard>
  );
}
