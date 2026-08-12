import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Board = {
  id: string;
  name: string;
};

export const MAX_BOARDS = 3;

// Shared tile geometry so every item in the stack — boards and the add tile —
// is the exact same shape and size.
const TILE =
  "relative aspect-video w-full overflow-hidden rounded-xl border";

type BoardStripProps = {
  boards: Board[];
  activeId: string | null;
  /** SVG data-URL preview per board id; empty/absent = blank board. */
  previews: Record<string, string>;
  /** Toggle a board: selecting the active one closes it. */
  onSelect: (id: string) => void;
  onAdd: () => void;
};

/**
 * Vertical stack of whiteboards. Each tile shows a live preview of that board's
 * drawing; the active board is simply rendered 10% larger. Horizontal padding
 * gives that scale-up room so its border isn't clipped by the scroll container.
 */
export function BoardStrip({
  boards,
  activeId,
  previews,
  onSelect,
  onAdd,
}: BoardStripProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      {boards.map((board) => {
        const active = board.id === activeId;
        const preview = previews[board.id];
        return (
          <button
            key={board.id}
            type="button"
            onClick={() => onSelect(board.id)}
            className={cn(
              TILE,
              "bg-white shadow-sm",
              active ? "scale-110 border-primary" : "border-border",
            )}
          >
            {preview ? (
              <img
                src={preview}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Empty
              </span>
            )}
            <span className="absolute bottom-1 left-1.5 rounded bg-background/70 px-1 text-[10px] font-medium text-foreground">
              {board.name}
            </span>
            {active && (
              <span className="absolute right-1.5 top-1.5 rounded bg-primary px-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Live
              </span>
            )}
          </button>
        );
      })}

      {boards.length < MAX_BOARDS && (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            TILE,
            "flex items-center justify-center gap-1.5 border-dashed border-border bg-transparent text-sm text-muted-foreground hover:text-foreground",
          )}
        >
          <PlusIcon className="size-4" />
          New board
        </button>
      )}
    </div>
  );
}
