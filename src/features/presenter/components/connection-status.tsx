import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/features/presenter/realtime";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Reconnecting…",
};

const DOT: Record<ConnectionStatus, string> = {
  connecting: "bg-muted-foreground animate-pulse",
  connected: "bg-secondary",
  disconnected: "bg-destructive animate-pulse",
};

export function ConnectionBadge({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", DOT[status])} />
      {LABEL[status]}
    </span>
  );
}
