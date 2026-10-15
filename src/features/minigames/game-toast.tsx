import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The one-line confirmation a game shows at the bottom of its own box.
 *
 * Positioned against the game rather than the viewport: on a slide the game may
 * be one block among others, or drawn scaled inside a studio preview, and a
 * toast pinned to the window would land somewhere else entirely.
 */
export function useGameToast(duration = 2400) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      setVisible(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(false), duration);
    },
    [duration],
  );

  const toast = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute bottom-[18px] left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_hsl(0_0%_0%/0.18)] transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {message}
    </div>
  );

  return { show, toast };
}
