import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";

/**
 * The way into the onboarding form, on the student's homepage.
 *
 * Sits above the homework nudge because nothing else on the page works until
 * it's done — the lessons below it are shut. Deliberately the same card as
 * @/features/learn/components/homework-cta so the page reads as one list of
 * things waiting on the student, not as a banner bolted on top.
 */
export function OnboardingCta({ done }: { done: boolean }) {
  if (done) return null;

  return (
    <Link
      to="/onboarding"
      className="flex items-center gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <SparklesIcon className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-medium">Finish your onboarding</span>
        <span className="block text-sm text-muted-foreground">
          Three quick questions so your classes fit you — your lessons unlock
          after it
        </span>
      </span>

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
