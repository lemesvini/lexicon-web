import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGoBack } from "@/hooks/use-go-back";
import { cn } from "@/lib/utils";

/**
 * The way back out of a page, drawn the one way it is drawn anywhere in the app:
 * a round outline button with an arrow in it and nothing else.
 *
 * It goes to the page the reader came from, or home when there is none — see
 * {@link useGoBack}.
 *
 * No visible label, because the label was never the thing being read — at this
 * size and in this position the arrow is recognised before any word next to it
 * is. The name is still there for anyone listening to the page.
 *
 * Lives apart from {@link SiteNav} only because two pages — the lesson console
 * and anything else that has to carry its own header — need this button without
 * the rest of that bar.
 */
export function BackButton({
  label = "Back",
  className,
}: {
  /** Its accessible name. */
  label?: string;
  className?: string;
}) {
  const goBack = useGoBack();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={goBack}
      aria-label={label}
      className={cn("rounded-full", className)}
    >
      <ArrowLeftIcon />
    </Button>
  );
}
