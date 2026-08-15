import * as React from "react";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublishStatus } from "../data/publishing";

/**
 * Publish / unpublish, in the editor's toolbar.
 *
 * Separate from Save on purpose. Saving a published document must not retract
 * it, and publishing must not be something that happens as a side effect of
 * fixing a typo — so the two are different buttons writing different columns.
 */
export function PublishToggle({
  status,
  onChange,
}: {
  /** null while the document has never been saved — nothing to publish yet. */
  status: PublishStatus | null;
  onChange: (status: PublishStatus) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  const published = status === "published";

  const toggle = async () => {
    if (status === null) return;
    setBusy(true);
    try {
      await onChange(published ? "draft" : "published");
    } catch (err) {
      alert(`Could not change the status: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={published ? "secondary" : "ghost"}
      size="sm"
      onClick={() => void toggle()}
      disabled={busy || status === null}
      title={
        status === null
          ? "Save it first"
          : published
            ? "Visible to students in this module"
            : "Students can't see this yet"
      }
    >
      {busy ? (
        <Loader2Icon className="animate-spin" />
      ) : published ? (
        <EyeIcon />
      ) : (
        <EyeOffIcon />
      )}
      {published ? "Published" : "Publish"}
    </Button>
  );
}
