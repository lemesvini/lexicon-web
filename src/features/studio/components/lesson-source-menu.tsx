import * as React from "react";
import { FolderOpenIcon, UploadIcon } from "lucide-react";

import type { Lesson } from "@/lib/lessons";
import { getLesson } from "@/lib/lessons";
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
import { parseLesson } from "../model";

/**
 * Loads a document into the editor from somewhere other than the cloud library:
 * a lesson bundled into the build (`src/situations/*.json`), or a JSON file on
 * disk.
 *
 * The cloud library is the Studio hub's job — this is what the hub can't reach.
 * The bundled situations in particular exist only in the build, so without this
 * menu a lesson that was never saved to the cloud would have no way back into
 * the editor.
 */
export function LessonSourceMenu({
  onLoad,
}: {
  onLoad: (lesson: Lesson) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

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

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <FolderOpenIcon />
            Open
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Bundled situations</DropdownMenuLabel>
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
    </>
  );
}
