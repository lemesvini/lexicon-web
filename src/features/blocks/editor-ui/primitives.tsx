import { PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoTextarea } from "./auto-textarea";

/** The small muted "label" that sits above most blocks (e.g. "Student's book"). */
export function BlockLabelInput({
  value,
  onChange,
  placeholder = "Label (optional)",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-xs font-semibold uppercase tracking-wide text-muted-foreground outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
    />
  );
}

/** Italic muted footnote used by several block types (`note` field). */
export function NoteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <AutoTextarea
      value={value}
      onValueChange={onChange}
      placeholder="Note (optional)"
      className="text-sm italic text-muted-foreground"
    />
  );
}

/** Round icon button for add/remove-row affordances inside blocks. */
export function IconAction({
  onClick,
  label,
  variant = "default",
  children,
}: {
  onClick: () => void;
  label: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent",
        variant === "danger" && "hover:bg-destructive/10 hover:text-destructive",
        "[&_svg]:size-3.5",
      )}
    >
      {children}
    </button>
  );
}

export function AddRowButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <PlusIcon className="size-3.5" />
      {label}
    </button>
  );
}

export function DeleteRowButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <IconAction onClick={onClick} label={label} variant="danger">
      <Trash2Icon />
    </IconAction>
  );
}
