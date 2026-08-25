import { EyeIcon, EyeOffIcon } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { PublishStatus } from "../data/publishing";

/**
 * Publish / unpublish, in the editor toolbar's menu.
 *
 * Separate from Save on purpose. Saving a published document must not retract
 * it, and publishing must not be something that happens as a side effect of
 * fixing a typo — so the two are different controls writing different columns.
 *
 * Stateless: the menu closes on select, so this is unmounted long before the
 * write comes back. The status it shows is the editor's, which is where it was
 * already kept.
 */
export function PublishMenuItem({
  status,
  onChange,
}: {
  /** null while the document has never been saved — nothing to publish yet. */
  status: PublishStatus | null;
  onChange: (status: PublishStatus) => Promise<void>;
}) {
  const published = status === "published";

  return (
    <DropdownMenuItem
      disabled={status === null}
      onSelect={() => {
        void onChange(published ? "draft" : "published").catch((err) => {
          alert(`Could not change the status: ${(err as Error).message}`);
        });
      }}
    >
      {published ? <EyeIcon /> : <EyeOffIcon />}
      {status === null
        ? "Publish (save it first)"
        : published
          ? "Unpublish"
          : "Publish"}
    </DropdownMenuItem>
  );
}
