import * as React from "react";
import { cn } from "@/lib/utils";
import { renderInline } from "./inline-md";

// Block-level markdown for lesson copy — the counterpart to inline-md, which
// only knows about marks *inside* a line.
//
// What an author types in the studio is what a student reads, so the shape of
// the text has to survive the trip: the blank line between a greeting and a
// body, the one-question-per-line list, the sign-off on its own line. Collapsing
// all of that into a single paragraph loses information the author put there on
// purpose.
//
// Kept as small as the inline renderer, and for the same reason: this is prose,
// not documentation. Paragraphs, hard line breaks, headings and lists — anything
// else falls through as plain text.

type MdNode =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; text: string };

const HEADING = /^(#{1,3})\s+(.*)$/;
/** The space after the marker is what keeps `**bold**` from reading as a bullet. */
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

function parseMarkdown(text: string): MdNode[] {
  const nodes: MdNode[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      nodes.push({ kind: "paragraph", text: paragraph.join("\n") });
    }
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      nodes.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    const ordered = ORDERED.test(line);
    if (ordered || BULLET.test(line)) {
      flush();
      // Consume the whole run of same-kind items, so a list is one node rather
      // than one node per line (which is what would give each item its own
      // paragraph spacing).
      const marker = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      let j = i;
      for (; j < lines.length; j++) {
        const item = marker.exec(lines[j]);
        if (!item) break;
        items.push(item[1]);
      }
      nodes.push({ kind: "list", ordered, items });
      i = j - 1;
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return nodes;
}

/** Sized in `em` so a passage keeps its proportions wherever it is set — the
 *  slide's large type, the studio's small type, the homework's in between. */
const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: "text-[1.3em] font-bold",
  2: "text-[1.15em] font-bold",
  3: "text-[1.05em] font-semibold",
};

/**
 * Renders lesson copy as markdown.
 *
 * Headings are `p`, not `h*`: a passage is quoted content sitting inside a
 * block that already owns its heading, and promoting a line of it would put a
 * false rung in the page's outline.
 */
export function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes = React.useMemo(() => parseMarkdown(text), [text]);

  return (
    <div className={cn("space-y-3", className)}>
      {nodes.map((node, i) => {
        if (node.kind === "heading") {
          return (
            <p key={i} className={HEADING_CLASS[node.level]}>
              {renderInline(node.text)}
            </p>
          );
        }

        if (node.kind === "list") {
          const List = node.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={cn(
                "space-y-1 pl-6",
                node.ordered ? "list-decimal" : "list-disc",
              )}
            >
              {node.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }

        // Single newlines inside a paragraph are the author's line breaks.
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(node.text)}
          </p>
        );
      })}
    </div>
  );
}
