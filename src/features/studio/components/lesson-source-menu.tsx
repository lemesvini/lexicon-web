import type { Lesson } from "@/lib/lessons";
import { getLesson } from "@/lib/lessons";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderOpenIcon, UploadIcon } from "lucide-react";
import { situations } from "@/features/homepage/data/situations";
import { parseLesson } from "../model";

/**
 * Loads a document into the editor from somewhere other than the cloud library:
 * a lesson bundled into the build (`src/situations/*.json`), or a JSON file on
 * disk. Items for the toolbar's menu.
 *
 * The cloud library is the Studio hub's job — this is what the hub can't reach.
 * The bundled situations in particular exist only in the build, so without this
 * a lesson that was never saved to the cloud would have no way back into the
 * editor.
 */
export function LessonSourceMenuItems({
  onLoad,
}: {
  onLoad: (lesson: Lesson) => void;
}) {
  /**
   * The file input is built and clicked here rather than rendered: anything
   * rendered inside a menu is unmounted the moment the menu closes, and a ref to
   * an input that no longer exists opens no file picker.
   */
  const importFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        onLoad(parseLesson(await file.text()));
      } catch (err) {
        alert(`Could not import file: ${(err as Error).message}`);
      }
    };
    input.click();
  };

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FolderOpenIcon />
          Open situation
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
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
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem onSelect={importFile}>
        <UploadIcon />
        Import JSON file…
      </DropdownMenuItem>
    </>
  );
}
