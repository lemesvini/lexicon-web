import { ONBOARDING_STEPS, type OnboardingAnswers } from "./questions";

/**
 * The answers as the teacher reads them.
 *
 * Plain question/answer text rather than JSON: this is appended to
 * `students.notes`, which is a free-text field a human edits and, more often,
 * pastes into a lesson prompt. Structure it would have to be un-structured
 * again at the other end.
 */
export function buildOnboardingSummary(answers: OnboardingAnswers): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`--- Onboarding (${date}) ---`];

  for (const step of ONBOARDING_STEPS) {
    if (step.kind === "intro") continue;

    const value =
      step.kind === "chips"
        ? answers.interests.join(", ")
        : answers[step.id as "motivation" | "routine"].trim();

    if (!value) continue;
    lines.push("", `Q: ${step.question}`, `A: ${value}`);
  }

  return lines.join("\n");
}
