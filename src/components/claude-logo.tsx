import { cn } from "@/lib/utils";

/**
 * Claude's mark — the asterisk, on its own.
 *
 * `public/claude-icon.png` rather than an inline SVG because it is the real
 * asset, and it has a genuine alpha channel, so it sits on the toolbar's dark
 * ground and on a light one without a plate behind it.
 */
export function ClaudeMark({ className }: { className?: string }) {
  return (
    <img
      src="/claude-icon.png"
      alt=""
      aria-hidden
      className={cn("size-4 shrink-0 object-contain", className)}
    />
  );
}

/**
 * The full lockup: the mark, then the name.
 *
 * Composed rather than using `public/claude-full.png`, and the reason is worth
 * recording. That file has no alpha channel — it is a white rectangle with the
 * word set in black — so on this app's dark surfaces it would show as a white
 * plate, and inverting it would take the asterisk's orange with it. Setting the
 * name as text lets it inherit `currentColor` and be legible in either theme,
 * while the mark stays the real asset.
 *
 * The serif is the app's own, not Claude's licensed face, so this is a close
 * likeness rather than the exact wordmark. Swap in a transparent, light-on-dark
 * export of the official lockup and this component can become a single `img`.
 */
export function ClaudeLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ClaudeMark className="size-6" />
      <span className="font-serif text-xl leading-none tracking-tight">
        Claude
      </span>
    </span>
  );
}
