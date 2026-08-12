import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// TV artwork intrinsic size (viewBox of tv-{dark,light}.svg).
const TV_WIDTH = 607;
const TV_HEIGHT = 424;

// Screen rectangle inside the TV frame, in TV-viewBox units. The frame outline
// spans x[7.5, 598.616] / y[7.5, 370.942] with a 15px stroke, so the inner edge
// of the border is half a stroke in — children fill exactly that area.
const SCREEN = {
  left: 15,
  top: 15,
  right: 591,
  bottom: 363,
};

export function TvScreen({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative w-full", className)}
      style={{ aspectRatio: `${TV_WIDTH} / ${TV_HEIGHT}` }}
    >
      {/* TV frame — swapped by theme. */}
      <img
        src="/homepage/tv-light.svg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full select-none dark:hidden"
        draggable={false}
      />
      <img
        src="/homepage/tv-dark.svg"
        alt=""
        aria-hidden
        className="absolute inset-0 hidden h-full w-full select-none dark:block"
        draggable={false}
      />

      {/* Content slot, clipped to the inner screen area. */}
      <div
        className="absolute"
        style={{
          left: `${(SCREEN.left / TV_WIDTH) * 100}%`,
          top: `${(SCREEN.top / TV_HEIGHT) * 100}%`,
          width: `${((SCREEN.right - SCREEN.left) / TV_WIDTH) * 100}%`,
          height: `${((SCREEN.bottom - SCREEN.top) / TV_HEIGHT) * 100}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
