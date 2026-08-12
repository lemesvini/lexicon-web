import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  FileJsonIcon,
  FilePlusIcon,
  FolderOpenIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import type { Lesson } from "@/lib/lessons";
import { getLesson } from "@/lib/lessons";
import { saveLessonToCloud } from "@/lib/lessons-cloud";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { situations } from "@/features/homepage/data/situations";
import { copyLesson, downloadLesson } from "../export";
import { parseLesson } from "../model";

export function StudioToolbar({
  document,
  onLoad,
  onNew,
  onToggleRaw,
  rawOpen,
}: {
  document: Lesson;
  onLoad: (lesson: Lesson) => void;
  onNew: () => void;
  onToggleRaw: () => void;
  rawOpen: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      onLoad(parseLesson(await file.text()));
    } catch (err) {
      alert(`Could not import file: ${(err as Error).message}`);
    }
  };

  const handleCopy = async () => {
    if (await copyLesson(document)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSaveToCloud = async () => {
    setSaveState("saving");
    try {
      await saveLessonToCloud(document);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("idle");
      alert(`Could not save to cloud: ${(err as Error).message}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/">
          <ArrowLeftIcon />
          Back
        </Link>
      </Button>

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-baseline gap-2">
        <span className="font-display text-3xl text-primary leading-none">Studio</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />

        <Button variant="ghost" size="sm" onClick={onNew}>
          <FilePlusIcon />
          New
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <FolderOpenIcon />
              Open
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Existing situations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {situations.length === 0 && (
              <DropdownMenuItem disabled>No situations found</DropdownMenuItem>
            )}
            {situations.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => {
                  const full = getLesson(s.id);
                  if (full) onLoad(full);
                }}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.module} · {s.unit}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <UploadIcon className="text-muted-foreground" />
              Import JSON file…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
          onClick={handleSaveToCloud}
          disabled={saveState === "saving"}
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
              : "Save to cloud"}
        </Button>

        <Button size="sm" onClick={() => downloadLesson(document)}>
          <DownloadIcon />
          Export
        </Button>
      </div>
    </header>
  );
}
