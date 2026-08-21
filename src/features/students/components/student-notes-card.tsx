import * as React from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setStudentNotes } from "@/features/students/data/student-profile";
import { StudentPanel } from "@/features/students/components/student-panel";

/**
 * The staff note on a student — what you'd otherwise keep in a spreadsheet: why
 * they're behind, what their exam is for, who to call.
 *
 * Saved explicitly rather than on a debounce. This is a field two people might
 * have open at once, and an autosave would let the slower typist's copy quietly
 * win; a button makes overwriting someone else a thing you did.
 *
 * Not visible to the student: `students` is readable by its own row's owner, so
 * anything genuinely private about them does not belong here.
 */
export function StudentNotesCard({
  studentId,
  notes,
}: {
  studentId: string;
  /**
   * The note as the row currently holds it. Seeds the field, and is what "has
   * this changed?" is measured against until the first save — after which the
   * panel measures against what it saved, since the row it was handed is by
   * then a version behind. The dashboard keys this component on the value, so a
   * reload that genuinely brings a different note starts the field again rather
   * than leaving a stale draft in place.
   */
  notes: string;
}) {
  const [draft, setDraft] = React.useState(notes);
  /** The last version known to be in the database. */
  const [saved, setSaved] = React.useState(notes);
  const [phase, setPhase] = React.useState<"idle" | "saving" | "saved">("idle");

  // Trimmed on both sides: trailing whitespace is not an edit worth offering a
  // Save button for, and it isn't stored either.
  const dirty = draft.trim() !== saved.trim();

  const save = async () => {
    const next = draft.trim();
    setPhase("saving");
    try {
      await setStudentNotes(studentId, next);
      setSaved(next);
      setPhase("saved");
    } catch (err) {
      alert((err as Error).message);
      setPhase("idle");
    }
  };

  return (
    <StudentPanel
      title="Notes"
      meta={
        phase === "saved" && !dirty ? (
          <span className="flex items-center gap-1">
            <CheckIcon className="size-3.5" />
            Saved
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3 px-5 py-4">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setPhase("idle");
          }}
          rows={5}
          placeholder="Anything worth remembering about this student…"
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
        />

        {/* The button only appears once there is something to save — an always-on
            Save invites clicking it to find out whether anything changed. */}
        {dirty && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={phase === "saving"}
            >
              {phase === "saving" && <Loader2Icon className="animate-spin" />}
              Save the note
            </Button>
          </div>
        )}
      </div>
    </StudentPanel>
  );
}
