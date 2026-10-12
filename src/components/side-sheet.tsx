import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The floating panel off the right edge that the lesson library opens a module
 * into — inset from the window, rounded, over a light scrim — so every list that
 * opens beside the page looks like the same kind of thing.
 *
 * Built on the Radix dialog rather than a positioned `<aside>`: escape, focus
 * trap and scroll lock come with it, and the page underneath can't be clicked
 * through to while a choice is half made.
 *
 * The body scrolls on its own, between a fixed header and an optional fixed
 * footer, so the title and the action stay put however long the list runs.
 */
export function SideSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  bodyClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** One short line under the title. */
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content
          className={cn(
            "fixed top-2 right-2 bottom-2 z-50 flex w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:slide-in-from-right motion-reduce:animate-none",
            className,
          )}
          // Without a description Radix warns; with `undefined` it is told
          // there deliberately isn't one.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <SheetPrimitive.Title className="truncate text-sm font-semibold tracking-tight">
                {title}
              </SheetPrimitive.Title>
              {description && (
                <SheetPrimitive.Description className="text-xs text-muted-foreground">
                  {description}
                </SheetPrimitive.Description>
              )}
            </div>
            <SheetPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </SheetPrimitive.Close>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer && <div className="border-t px-4 py-3">{footer}</div>}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
