import {
  CalendarCheckIcon,
  FileTextIcon,
  KeyRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One action in the bar: an icon over a label, in a column, the way iOS stacks
 * the controls in a share sheet.
 *
 * Disabled actions stay in place rather than being hidden. A toolbar whose
 * buttons come and go is one the reader has to re-read every visit, and
 * "Report" being visibly not-yet is more honest than it being absent.
 */
function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
  /** Says why it can't be used — the browser tooltip, and the accessible name's
   *  supplement. Only meaningful when `disabled`. */
  hint,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? hint : undefined}
      // `aria-disabled` as well as `disabled`: the native attribute takes the
      // button out of the tab order, and a control the reader can never land on
      // is one they can never be told the reason for.
      aria-disabled={disabled}
      className={cn(
        "flex min-w-20 flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-center transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        disabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="text-xs font-medium leading-none">{label}</span>
    </button>
  );
}

/**
 * The quick actions for the student on screen, docked to the bottom of the
 * page as a floating stack.
 *
 * Down here rather than in the profile tile's menu because these are the things
 * you do *while* reading the page — you find the absence, then fix the
 * register; you hear they're locked out, then issue a password. A menu you have
 * to scroll back up to open puts the page between the reader and the thing the
 * page just told them to do.
 *
 * `sticky`, not `fixed`: the bar belongs to the page's column and moves left
 * with it when the detail rail opens. A fixed bar would be measured against the
 * viewport and would slide under the rail.
 */
export function StudentActionBar({
  onResetPassword,
  onEditAttendance,
  /** No register has been taken for them yet, so there is nothing to correct. */
  canEditAttendance,
  /** Only an account can have its password reset — a roster row without one has
   *  nothing to issue against. */
  canResetPassword,
}: {
  onResetPassword: () => void;
  onEditAttendance: () => void;
  canEditAttendance: boolean;
  canResetPassword: boolean;
}) {
  return (
    // The wrapper is what sticks; the pill inside is what the reader sees. The
    // bottom padding keeps it clear of the viewport edge, and `pointer-events`
    // is handed back only to the pill so the transparent gutter beside it
    // doesn't swallow clicks on the tiles underneath.
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-popover/90 p-1.5 text-popover-foreground shadow-lg backdrop-blur">
        <Action
          icon={KeyRoundIcon}
          label="New password"
          onClick={onResetPassword}
          disabled={!canResetPassword}
          hint="They have no sign-in account yet."
        />
        <Action
          icon={CalendarCheckIcon}
          label="Attendance"
          onClick={onEditAttendance}
          disabled={!canEditAttendance}
          hint="No register has been taken for them yet."
        />
        <Action
          icon={FileTextIcon}
          label="Report"
          disabled
          hint="Reports aren’t ready yet."
        />
      </div>
    </div>
  );
}
