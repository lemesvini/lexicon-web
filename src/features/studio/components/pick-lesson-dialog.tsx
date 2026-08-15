import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import type { LibraryLessonRow } from "../data/library";

/**
 * Picks the lesson a student material belongs to.
 *
 * A material is not created from nothing — it is one lesson's student-facing
 * half, so choosing the lesson IS creating it. Searchable rather than a plain
 * select because this list grows with the curriculum, and it shows which lessons
 * already have material so the choice isn't made blind.
 */
export function PickLessonDialog({
  open,
  onOpenChange,
  lessons,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessons: LibraryLessonRow[];
  onPick: (lessonId: string) => void;
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Material for which lesson?"
      description="Pick the lesson this material is the student's copy of."
      className="max-w-lg rounded-2xl"
    >
      <CommandInput placeholder="Search lessons…" />

      <CommandList className="max-h-[400px]">
        <CommandEmpty>No lessons found.</CommandEmpty>

        <CommandGroup>
          {lessons.map((lesson) => (
            <CommandItem
              key={lesson.id}
              value={`${lesson.title} ${lesson.module} ${lesson.unit}`}
              onSelect={() => {
                onOpenChange(false);
                onPick(lesson.id);
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {lesson.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[lesson.module, lesson.unit].filter(Boolean).join(" · ") ||
                    lesson.id}
                </span>
              </div>

              {lesson.materialStatus && (
                <Badge
                  variant="outline"
                  className="ml-auto shrink-0 text-muted-foreground"
                >
                  {lesson.materialStatus === "published"
                    ? "Has material"
                    : "Draft material"}
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
