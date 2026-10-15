import { useEffect, useState } from "react";

/**
 * A two-click remove: the first click arms it, the second does it, and any click
 * anywhere else stands it down.
 *
 * Holds the id of whatever is armed. The control that arms it must carry a
 * `data-remove` attribute — that is how a click on it is told apart from "any
 * click anywhere else".
 */
export function useArmed() {
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    function disarm(e: MouseEvent) {
      if (!(e.target as Element | null)?.closest("[data-remove]")) setArmed(null);
    }
    document.addEventListener("click", disarm);
    return () => document.removeEventListener("click", disarm);
  }, [armed]);

  return [armed, setArmed] as const;
}
