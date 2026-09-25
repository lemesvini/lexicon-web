import { PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BLOCK_ORDER, blockMetas, type BlockType } from "@/features/blocks";

/** The bar under a slide's blocks. Adds a block to the end of that slide. */
export function AddBlockMenu({
  onAdd,
  blockTypes = BLOCK_ORDER,
}: {
  onAdd: (type: BlockType) => void;
  blockTypes?: BlockType[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-4" />
          Add block
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel>Add block</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {blockMetas(blockTypes).map((b) => {
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
