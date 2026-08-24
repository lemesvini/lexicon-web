import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileJsonIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "lucide-react";

import type { Lesson } from "@/lib/lessons";
import { Button } from "@/components/ui/button";
import { ClaudeMark } from "@/components/claude-logo";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onTogglePreview,
  previewOn,
  drawerLabel,
  drawerOpen = false,
  onToggleDrawer,
  portable = true,
  back,
  compact = false,
  menuItems,
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
  onTogglePreview: () => void;
  previewOn: boolean;
  /** Names the editor's side drawer. Undefined in the editors that have none,
   *  which is what hides the toggle rather than showing a dead button. */
  drawerLabel?: string;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  /**
   * Whether this document can leave the app — Copy and Export.
   *
   * False for a group's copy of a lesson. A file on someone's desktop called
   * "situation-one.json" that is actually one class's version of it is a trap:
   * re-import it and you have quietly replaced the lesson every other class is
   * taught. The copy belongs to the group, and the way to move it is to make
   * another copy from the group's Lessons tab.
   */
  portable?: boolean;
  /**
   * Overrides the top-left button, for an editor the library isn't the way back
   * from. A group's copy of a lesson is opened from that group far more often
   * than from the library, and sending them to the library is sending them
   * somewhere they weren't.
   */
  back?: { label: string; onClick: () => void };
  /**
   * Collapse the right-hand side to three icons: a menu holding everything that
   * isn't urgent, Save, and the assistant.
   *
   * For the editors where the toolbar has to share the top of the screen with a
   * drawer. Six labelled buttons in half the width run into the centred wordmark;
   * three icons don't.
   */
  compact?: boolean;
  /** Extra `DropdownMenuItem`s for the compact menu — the kind-specific actions
   *  that would otherwise be `children`. Ignored when `compact` is false. */
  menuItems?: React.ReactNode;
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
      {back ? (
        <Button variant="ghost" size="sm" onClick={back.onClick}>
          <ArrowLeftIcon />
          {back.label}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" asChild>
          <Link to="/studio">
            <ArrowLeftIcon />
            Library
          </Link>
        </Button>
      )}

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

      {compact ? (
        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More">
                <MoreHorizontalIcon />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={previewOn}
                onCheckedChange={onTogglePreview}
              >
                Slide previews
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={rawOpen}
                onCheckedChange={onToggleRaw}
              >
                JSON
              </DropdownMenuCheckboxItem>
              {portable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleCopy()}>
                    {copied ? "Copied" : "Copy"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => downloadLesson(document)}>
                    Export
                  </DropdownMenuItem>
                </>
              )}
              {menuItems && (
                <>
                  <DropdownMenuSeparator />
                  {menuItems}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={saveState === "saving" || !canSave}
            title={saveLabel}
          >
            {saveState === "saving" ? (
              <Loader2Icon className="animate-spin" />
            ) : saveState === "saved" ? (
              <CheckIcon />
            ) : (
              <CloudUploadIcon />
            )}
            <span className="sr-only">{saveLabel}</span>
          </Button>

          {drawerLabel && onToggleDrawer && (
            <Button
              variant={drawerOpen ? "secondary" : "ghost"}
              size="icon"
              aria-pressed={drawerOpen}
              onClick={onToggleDrawer}
              title={drawerLabel}
            >
              <ClaudeMark className="size-5" />
              <span className="sr-only">{drawerLabel}</span>
            </Button>
          )}
        </div>
      ) : (
      <div className="ml-auto flex items-center gap-1.5">
        {children}

        <Button
          variant={previewOn ? "secondary" : "ghost"}
          size="sm"
          onClick={onTogglePreview}
          title={
            previewOn
              ? "Slide previews shown — click to hide them"
              : "Slide previews hidden — click to show them"
          }
        >
          {previewOn ? <EyeIcon /> : <EyeOffIcon />}
          Preview
        </Button>

        <Button
          variant={rawOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleRaw}
        >
          <FileJsonIcon />
          JSON
        </Button>

        {portable && (
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}

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

        {portable && (
          <Button size="sm" onClick={() => downloadLesson(document)}>
            <DownloadIcon />
            Export
          </Button>
        )}

        {/* Last, and the only filled button when the exports are gone: in the
            editor that has one, the agent is the thing the editor is about. */}
        {drawerLabel && onToggleDrawer && (
          <Button
            variant={drawerOpen ? "secondary" : "default"}
            size="sm"
            aria-pressed={drawerOpen}
            onClick={onToggleDrawer}
          >
            <SparklesIcon />
            {drawerLabel}
          </Button>
        )}
      </div>
      )}
    </header>
  );
}
