import { useEffect } from "react";

/**
 * Global ArrowLeft/ArrowRight navigation as a fallback for when no physical
 * controller (or the iPad control page) is driving the deck. Ignored while the
 * user is typing or drawing so inputs and the whiteboard keep the arrow keys.
 */
export function useArrowKeyNav(goPrev: () => void, goNext: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        el?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el?.closest(".excalidraw")
      ) {
        return;
      }

      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);
}
