import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/features/groups/data/groups";

/**
 * The days a group meets, as seven toggles.
 *
 * Toggles rather than a multi-select dropdown: there are exactly seven options,
 * they never change, and the answer is something you want to read at a glance
 * afterwards — all of which a dropdown is worse at than a row of buttons.
 *
 * Each is a real toggle button (`aria-pressed`) rather than a checkbox, because
 * the label is the control: a three-letter box with a tick beside it would be
 * wider than the thing it labels.
 */
export function WeekdayPicker({
  value,
  onChange,
  disabled = false,
  /** Ties the group to its label for screen readers — see the callers. */
  "aria-labelledby": labelledBy,
}: {
  value: readonly number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  "aria-labelledby"?: string;
}) {
  const toggle = (day: number) => {
    onChange(
      value.includes(day)
        ? value.filter((selected) => selected !== day)
        : [...value, day],
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={labelledBy}>
      {WEEKDAYS.map((weekday) => {
        const selected = value.includes(weekday.day);
        return (
          <button
            key={weekday.day}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => toggle(weekday.day)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {weekday.short}
            <span className="sr-only"> {weekday.long}</span>
          </button>
        );
      })}
    </div>
  );
}
