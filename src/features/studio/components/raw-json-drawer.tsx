import * as React from "react";
import { CheckIcon, CopyIcon, DownloadIcon, XIcon } from "lucide-react";
import type { Lesson } from "@/lib/lessons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyLesson, downloadLesson, lessonToJson } from "../export";
import { parseLesson } from "../model";

/**
 * Slide-over showing the live lesson JSON. Read-only by default; toggle Edit to
 * paste/patch JSON and apply it back into the editor (the "import by paste" path).
 */
export function RawJsonDrawer({
  open,
  document,
  onClose,
  onApply,
}: {
  open: boolean;
  document: Lesson;
  onClose: () => void;
  onApply: (lesson: Lesson) => void;
}) {
  const json = lessonToJson(document);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(json);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // When not editing, the textarea mirrors the live document directly; `draft`
  // is only the working copy while editing (seeded when Edit is toggled on).
  const value = editing ? draft : json;

  const apply = () => {
    try {
      onApply(parseLesson(draft));
      setEditing(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copy = async () => {
    if (await copyLesson(document)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l bg-card shadow-2xl transition-transform duration-300",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Lesson JSON</span>
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setError(null);
              setDraft(json);
            }}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              editing
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground hover:bg-accent",
            )}
          >
            {editing ? "Editing" : "Edit / paste"}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <textarea
        value={value}
        readOnly={!editing}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className={cn(
          "flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed outline-none",
          !editing && "text-muted-foreground",
        )}
      />

      {error && (
        <p className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 border-t px-4 py-3">
        {editing ? (
          <>
            <Button size="sm" onClick={apply}>
              Apply to editor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(json);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => downloadLesson(document)}>
              <DownloadIcon />
              Export
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
