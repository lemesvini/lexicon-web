import { PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BLOCK_METAS, type BlockType } from "@/features/blocks";

/** The "+" affordance in a slide's top-right corner. Adds a block to that slide. */
export function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add block"
          title="Add block"
          className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Add block</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BLOCK_METAS.map((b) => {
          const Icon = b.icon;
          return (
            <DropdownMenuItem key={b.type} onSelect={() => onAdd(b.type)}>
              <Icon className="text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{b.label}</span>
                <span className="text-xs text-muted-foreground">{b.hint}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
