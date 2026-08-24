import * as React from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { OnboardingStepper } from "@/features/onboarding/components/onboarding-stepper";
import { saveOnboarding } from "@/features/onboarding/data/onboarding";
import { buildOnboardingSummary } from "@/features/onboarding/summary";
import type { OnboardingAnswers } from "@/features/onboarding/questions";

/**
 * The first-visit questionnaire, on a page of its own.
 *
 * No `SiteNav`: the whole point is one screen with one thing on it. There is
 * nowhere else to be until it's answered, so navigation would only be an
 * invitation to leave.
 */
export const Route = createFileRoute("/_authenticated/_student/onboarding")({
  beforeLoad: ({ context }) => {
    // Answering is once-only in the database (see 0012), so a student who has
    // already been through here would only meet an error at the end.
    if (context.access?.onboardedAt) throw redirect({ to: "/learn" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const finish = (answers: OnboardingAnswers) => {
    setSubmitting(true);
    setError(null);

    saveOnboarding(buildOnboardingSummary(answers))
      .then(async () => {
        // Invalidate first: `_student`'s beforeLoad is what carries
        // `onboardedAt`, and without a reload /learn would render still locked.
        await router.invalidate();
        await router.navigate({ to: "/learn" });
      })
      .catch(() => {
        setSubmitting(false);
        setError("Não foi possível salvar suas respostas.");
      });
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Montserrat on the whole page, so every label and answer inherits it;
          the headings inside opt back out into the display face. */}
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 font-montserrat">
        <OnboardingStepper
          onFinish={finish}
          submitting={submitting}
          error={error}
        />
      </main>
    </div>
  );
}
