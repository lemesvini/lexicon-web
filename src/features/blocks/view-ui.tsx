import { renderInline } from "./inline-md";

// Read-only presentation primitives shared by every block's `View`. Keeping the
// label and note treatments here (rather than repeated per block) is what makes
// a slide read as one designed surface instead of five ad-hoc ones.

/** Small uppercase eyebrow above a block's content. */
export function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

/** Muted footnote below a block — rendered as a quiet left-ruled aside. */
export function BlockNote({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line border-l-2 border-border pl-3 text-sm italic leading-relaxed text-muted-foreground">
      {renderInline(text)}
    </p>
  );
}
