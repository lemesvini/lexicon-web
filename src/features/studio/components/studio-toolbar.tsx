import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  FileJsonIcon,
  Loader2Icon,
} from "lucide-react";

import type { Lesson } from "@/lib/lessons";
import { Button } from "@/components/ui/button";
import { copyLesson, downloadLesson } from "../export";

/**
 * The editor's top bar, shared by all three kinds of document.
 *
 * What every kind gets: back to the library, the JSON drawer, copy, save,
 * export. What differs — where a document is opened from, whether it can be
 * published, what it is called — arrives through `children` and `label`, so the
 * three editors share this chrome instead of each growing their own.
 *
 * Saving is a prop rather than a fixed call to the cloud, but the idle → saving
 * → saved cycle stays here: it is the same three states with the same timing in
 * every editor, and it is the sort of thing that drifts if copied.
 */
export function StudioToolbar({
  document,
  label,
  onSave,
  saveLabel = "Save to cloud",
  canSave = true,
  onToggleRaw,
  rawOpen,
  children,
}: {
  document: Lesson;
  /** What this editor is working on, e.g. "Presentation". */
  label: string;
  onSave: () => Promise<void>;
  saveLabel?: string;
  /** False while the document is missing whatever the save needs (an id, say). */
  canSave?: boolean;
  onToggleRaw: () => void;
  rawOpen: boolean;
  /** Kind-specific actions, rendered before the shared ones. */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const handleCopy = async () => {
    if (await copyLesson(document)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await onSave();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("idle");
      alert(`Could not save: ${(err as Error).message}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/studio">
          <ArrowLeftIcon />
          Library
        </Link>
      </Button>

      {/* Anchored to the header box, not to its own static position: laid out
          after the Library button, a `w-full` overlay starts at that button's
          right edge and hangs off the page. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl leading-none text-primary">
          Studio
        </span>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {label}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {children}

        <Button
          variant={rawOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleRaw}
        >
          <FileJsonIcon />
          JSON
        </Button>

        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saveState === "saving" || !canSave}
        >
          {saveState === "saving" ? (
            <Loader2Icon className="animate-spin" />
          ) : saveState === "saved" ? (
            <CheckIcon />
          ) : (
            <CloudUploadIcon />
          )}
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveLabel}
        </Button>

        <Button size="sm" onClick={() => downloadLesson(document)}>
          <DownloadIcon />
          Export
        </Button>
      </div>
    </header>
  );
}
