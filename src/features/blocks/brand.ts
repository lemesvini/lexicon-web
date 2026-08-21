/**
 * The brand palette, for blocks that are projected rather than read in the app.
 *
 * Written out here instead of read from the theme tokens in index.css, and that
 * is the whole point: a cover slide or a branded email window must look the same
 * whichever theme the teacher's own machine is in. The room sees the brand, not
 * somebody's dark mode. Theme tokens (`bg-card`, `text-muted-foreground`) are
 * for the blocks that *should* follow the app — text, list, table, dialog.
 *
 * Kept in oklch to match index.css, with the design source's hex alongside.
 * Anything added here should be a colour the brand actually owns; a one-off tint
 * belongs in the block that needs it.
 */

/** Brand green. #61B495 */
export const JADE = "oklch(0.7084 0.0942 167.3388)";

/** Deep green — the dark ground. #14352A */
export const FOREST = "oklch(0.3004 0.0440 168.9151)";

/** Pale green — the light ground. #DFF2EA in the design source; the value below
 *  is the one this palette has always rendered and the two are a hair apart. */
export const MIST = "oklch(0.9400 0.0300 167.0000)";

/** Near-black, faintly green. The app's own foreground. #0E1412 */
export const INK = "oklch(0.1841 0.0101 172.8800)";

/** Warm off-white. The app's own background. #F6F0EB */
export const SAND = "oklch(0.9584 0.0093 62.5849)";

/**
 * A brand colour at partial opacity — for hairlines, scrims and quiet type.
 *
 * Every colour above is an `oklch(...)` string, so the alpha variant is that
 * same string with `/ a` before the paren. Deriving it beats writing the
 * channels out a second time: a tint typed by hand is a copy that goes stale
 * the day the colour it was copied from moves.
 */
export function withAlpha(color: string, alpha: number): string {
  return color.replace(/\)$/, ` / ${alpha})`);
}
