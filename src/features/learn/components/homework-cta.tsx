import { Link } from "@tanstack/react-router";
import { CheckIcon, ChevronRightIcon, NotebookPenIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudentHomework, StudentSubmission } from "@/lib/student-content";

/**
 * The nudge towards homework on the student's homepage.
 *
 * Homework lives in its own section of the app now, which is right — but a
 * section nobody visits is a section nobody does. This says how much is waiting
 * without the student having to go and look.
 *
 * It renders nothing when no homework has been set at all: a card announcing
 * that there is nothing to announce is noise on the one page the student opens
 * every day.
 */
export function HomeworkCta({
  homework,
  submissions,
}: {
  homework: StudentHomework[];
  submissions: Map<string, StudentSubmission>;
}) {
  if (homework.length === 0) return null;

  // Anything not yet handed in is still theirs to do — a submission left in
  // progress counts exactly like one never started.
  const todo = homework.filter((task) => {
    const submission = submissions.get(task.id);
    return !submission || submission.status === "in_progress";
  }).length;

  const marked = homework.filter(
    (task) => submissions.get(task.id)?.status === "graded",
  ).length;

  const waiting = todo > 0;

  return (
    <Link
      to="/homework"
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        waiting
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
          : "hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          waiting
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {waiting ? (
          <NotebookPenIcon className="size-5" />
        ) : (
          <CheckIcon className="size-5" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-medium font-montserrat">
          {waiting
            ? `${todo} assignments waiting`
            : "You're up to date on homework"}
        </span> 
        <span className="block text-sm text-muted-foreground font-montserrat">
          {marked > 0
            ? `${marked} marked — see how you did`
            : waiting
              ? "Seu progresso fica salvo automaticamente "
              : "Nothing waiting on you"}
        </span>
      </span>

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
