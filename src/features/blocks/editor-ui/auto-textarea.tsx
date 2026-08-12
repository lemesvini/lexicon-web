import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"textarea">, "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A borderless textarea that grows to fit its content — the workhorse of the
 * inline editor. Looks like plain text until focused; single field, multi-line.
 */
export function AutoTextarea({
  value,
  onValueChange,
  className,
  ...props
}: Props) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => {
        onValueChange(e.target.value);
        resize();
      }}
      className={cn(
        "w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/60",
        "focus:rounded-sm focus:ring-2 focus:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}
