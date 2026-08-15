import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STUDIO_KINDS, type StudioKind } from "../kinds";

/**
 * The Studio's front door: what are we making?
 *
 * The three kinds are one choice made once, at the start — the alternative was
 * three separate "New …" buttons scattered across the library, which asks the
 * same question in a place where it is easy to answer by accident.
 */
export function CreateArtifactDialog({
  open,
  onOpenChange,
  onSelect,
  enabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (kind: StudioKind) => void;
  /** Kinds whose editor exists. The rest render disabled rather than absent, so
   *  the shape of the thing stays visible while it is being built. */
  enabled: readonly StudioKind[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What are you making?</DialogTitle>
          <DialogDescription>
            All three are built from the same blocks — they differ in who reads
            them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {STUDIO_KINDS.map(({ kind, singular, hint, icon: Icon }) => {
            const available = enabled.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                disabled={!available}
                onClick={() => {
                  onOpenChange(false);
                  onSelect(kind);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  available
                    ? "hover:border-primary/40 hover:bg-accent"
                    : "cursor-not-allowed opacity-55",
                )}
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{singular}</span>
                    {!available && (
                      <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
