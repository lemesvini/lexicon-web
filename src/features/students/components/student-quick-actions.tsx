import * as React from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TempPasswordPanel } from "@/components/temp-password-panel";
import { cn } from "@/lib/utils";
import { fromDateKey } from "@/features/groups/data/groups";
import { formatDay } from "@/features/students/components/student-formats";
import {
  setClassAttendance,
  type StudentClass,
} from "@/features/students/data/student-profile";
import { resetStudentPassword } from "@/features/students/data/students";

// Both dialogs below split their body into a child that is only mounted while
// the dialog is open. That is what makes "start again each time it opens" the
// default rather than something an effect has to reproduce: the state is seeded
// once, on mount, and thrown away on close.

/** Issues the password, then shows it. Mounted per opening — see above. */
function ResetPasswordBody({
  student,
}: {
  student: { id: string; name: string; email: string };
}) {
  const [phase, setPhase] = React.useState<"working" | "done" | "failed">(
    "working",
  );
  const [password, setPassword] = React.useState("");
  const [failure, setFailure] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    resetStudentPassword(student.id)
      .then(({ tempPassword }) => {
        if (cancelled) return;
        setPassword(tempPassword);
        setPhase("done");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure((err as Error).message);
        setPhase("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  if (phase === "working") {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Issuing it…
      </p>
    );
  }

  if (phase === "failed") {
    return <p className="py-2 font-mono text-xs text-destructive">{failure}</p>;
  }

  return <TempPasswordPanel email={student.email} password={password} />;
}

/**
 * Issues a fresh temporary password and shows it once.
 *
 * Fires on open rather than behind a confirm button: the reader got here by
 * pressing "New password" on a toolbar, which is the confirmation. A second
 * "are you sure" for an action whose only cost is that the old password stops
 * working is a click that teaches people to click through dialogs.
 */
export function ResetPasswordDialog({
  student,
  open,
  onOpenChange,
}: {
  student: { id: string; name: string; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A new password for {student.name}</DialogTitle>
          <DialogDescription>
            Their old one stops working now. This is the only time the new one is
            shown — hand it over before closing.
          </DialogDescription>
        </DialogHeader>

        {open && <ResetPasswordBody student={student} />}
      </DialogContent>
    </Dialog>
  );
}

/** One day on the register, with the toggle that corrects it. */
function DayRow({
  session,
  onFlip,
}: {
  session: StudentClass;
  onFlip: (present: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  const flip = async () => {
    setBusy(true);
    try {
      await onFlip(!session.present);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm tabular-nums">
          {formatDay(fromDateKey(session.classDate))}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[session.groupName, session.lessonTitle].filter(Boolean).join(" · ") ||
            "—"}
        </p>
      </div>

      {/* One button that says what the day currently is and flips it — rather
          than a present/absent pair, where the lit one and the one you press
          look alike and the reader has to work out which is which. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => void flip()}
        disabled={busy}
        className={cn(
          "w-28 justify-center",
          session.present
            ? "border-primary/40 text-primary"
            : "border-destructive/40 text-destructive",
        )}
      >
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : session.present ? (
          <CheckIcon />
        ) : (
          <XIcon />
        )}
        {session.present ? "Present" : "Absent"}
      </Button>
    </li>
  );
}

/** The register itself. Mounted per opening, so `classes` seeds its working
 *  copy once and a flip shows immediately without waiting on a refetch. */
function EditAttendanceBody({
  classes,
  onDirty,
}: {
  classes: StudentClass[];
  onDirty: () => void;
}) {
  const [rows, setRows] = React.useState(classes);
  const [failure, setFailure] = React.useState("");

  const flip = async (session: StudentClass, present: boolean) => {
    setFailure("");
    try {
      await setClassAttendance(session.id, present);
      setRows((current) =>
        current.map((row) => (row.id === session.id ? { ...row, present } : row)),
      );
      onDirty();
    } catch (err) {
      setFailure((err as Error).message);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No register has been taken for them yet.
      </p>
    );
  }

  return (
    <>
      {failure && <p className="font-mono text-xs text-destructive">{failure}</p>}

      <ul className="no-scrollbar max-h-[min(60vh,28rem)] divide-y overflow-y-auto">
        {rows.map((session) => (
          <DayRow
            key={session.id}
            session={session}
            onFlip={(present) => flip(session, present)}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * Corrects the register for a day already recorded.
 *
 * Only days someone actually took a register for are listed — a class with no
 * register isn't an absence, it is a class nobody marked, and offering to flip
 * a day that was never held would put a fact into the record that no teacher
 * ever asserted. Adding a day belongs to the group's own screen.
 *
 * Saves on each flip rather than collecting changes behind a Save. A register
 * correction is usually one row — "they were here on Tuesday, I marked the
 * wrong name" — and a form for a single toggle is ceremony.
 */
export function EditAttendanceDialog({
  classes,
  open,
  onOpenChange,
  /** Refetches the dossier once the dialog closes, so the tiles and the rail
   *  agree with what was just changed. Deferred to close rather than run per
   *  flip: reloading under the reader's cursor would re-sort the list they are
   *  still working through. */
  onChanged,
}: {
  /** Newest first, as `fetchStudentDossier` returns them. */
  classes: StudentClass[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  // Whether anything was actually flipped this visit. A ref, not state: nothing
  // renders differently for it, and it is read once, on the way out.
  const dirty = React.useRef(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next && dirty.current) {
      dirty.current = false;
      onChanged();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit attendance</DialogTitle>
          <DialogDescription>
            The days a register was taken for them. Press a day to flip it.
            Classes nobody marked aren’t listed — add those from the group.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <EditAttendanceBody
            classes={classes}
            onDirty={() => {
              dirty.current = true;
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
