// Formatting for a class's title, shared by every card that draws one as a
// cover: @/features/homepage/components/class-card and lesson-row-card.

/**
 * Splits `"[Lesson One] Nice to meet you!"` into the lesson's label and its
 * name. Both halves are optional: a title with no bracket is all name, which is
 * what an older lesson or a file opened from disk will be.
 */
export function splitTitle(title: string): { label: string; name: string } {
  const match = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(title);
  if (!match) return { label: "", name: title };
  return { label: match[1].trim(), name: match[2].trim() || title };
}

/**
 * Breaks a headline across two or three lines of roughly equal length.
 *
 * The title block sizes its headline to the longest line it is given and keeps
 * the author's line breaks — which is right on a slide, where someone decided
 * where it wraps, and wrong here, where the string came out of a database
 * column as one long line and would be set tiny to fit. So the card picks the
 * breaks the author never got to.
 */
export function wrapHeadline(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return text;

  const lines = Math.min(3, Math.max(2, Math.ceil(text.length / 14)));
  const target = Math.ceil(text.length / lines);

  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (
      line.length + 1 + word.length > target &&
      out.length < lines - 1
    ) {
      out.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  out.push(line);
  return out.join("\n");
}
