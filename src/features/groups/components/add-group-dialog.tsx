import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeekdayPicker } from "@/features/groups/components/weekday-picker";
import { createGroup, formatDays } from "@/features/groups/data/groups";
import type { TeacherOption } from "@/features/students/data/students";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

// Radix's Select has no concept of an empty value, so "no lesson yet" needs a
// sentinel of its own.
const NO_LESSON_VALUE = "none";

/**
 * Starts a group. Only the name is required — a group with nobody in it and no
 * lesson set is a perfectly good empty register, and both are one click away on
 * the panel once it exists.
 */
export function AddGroupDialog({
  teachers,
  currentTeacherId,
  lessons,
  onCreated,
}: {
  /**
   * Who the group can belong to. One entry (or none) for a teacher — they can
   * only create their own, so the field isn't shown at all.
   */
  teachers: TeacherOption[];
  /** The signed-in user, who the picker starts on. */
  currentTeacherId: string;
  lessons: CloudLessonSummary[];
  /** Called with the new group's id, so the board can select it. */
  onCreated: (groupId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [meetsOn, setMeetsOn] = React.useState<number[]>([]);
  const [schedule, setSchedule] = React.useState("");
  const [teacherId, setTeacherId] = React.useState(currentTeacherId);
  const [lessonId, setLessonId] = React.useState(NO_LESSON_VALUE);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canPickTeacher = teachers.length > 1;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    setName("");
    setMeetsOn([]);
    setSchedule("");
    setTeacherId(currentTeacherId);
    setLessonId(NO_LESSON_VALUE);
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Give the group a name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const groupId = await createGroup({
        name,
        // A teacher can only ever file a group under themselves — the write
        // policy rejects anything else — so the picker's value is only read
        // when there was a choice to make.
        teacherId: canPickTeacher ? teacherId : currentTeacherId,
        meetsOn,
        schedule,
        lessonId: lessonId === NO_LESSON_VALUE ? null : lessonId,
      });
      onCreated(groupId);
      handleOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PlusIcon />
          New group
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Students taught together. You can add them, and take the register,
            once it exists.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              placeholder="Tuesday evening"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label id="group-days-label">Meets on</Label>
            <WeekdayPicker
              value={meetsOn}
              onChange={setMeetsOn}
              aria-labelledby="group-days-label"
            />
            <p className="text-xs text-muted-foreground">
              {meetsOn.length === 0
                ? "No fixed days — the group won’t appear under today’s classes."
                : `${formatDays(meetsOn)} · ${meetsOn.length} class${
                    meetsOn.length === 1 ? "" : "es"
                  } a week`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-schedule">Time (optional)</Label>
            <Input
              id="group-schedule"
              placeholder="19:00"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </div>

          {canPickTeacher && (
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Current lesson (optional)</Label>
            <Select value={lessonId} onValueChange={setLessonId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a lesson" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LESSON_VALUE}>No lesson yet</SelectItem>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.module ? `${lesson.module} · ` : ""}
                    {lesson.title || lesson.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" disabled={busy} onClick={() => void save()}>
            {busy ? "Creating…" : "Create group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
