import { createContext } from "react";

export type SidebarState = {
  /** Whether the panel is showing, however it was opened. */
  open: boolean;
  /**
   * Opened deliberately — by the menu button or ⌘K — rather than by brushing the
   * left edge. A locked panel ignores the pointer leaving it, and is dismissed
   * by clicking away, pressing Escape, or going somewhere.
   */
  locked: boolean;
  /**
   * The wordmark is mid-flight between the header and the panel. The header
   * keeps its copy hidden for the whole of it — including the flight back, which
   * outlasts `open`.
   */
  flying: boolean;
  /**
   * The header hands its wordmark over so the panel can fly it in. A ref
   * callback: React passes the element on mount and null on unmount, and pages
   * that render no header simply never call it.
   */
  registerWordmark: (element: HTMLElement | null) => void;
  /** The menu button and the keyboard shortcut. */
  toggle: () => void;
  close: () => void;
  /** The hover edge. Ignored while locked, so a stray mouse can't close it. */
  peek: () => void;
  unpeek: () => void;
};

export const SidebarContext = createContext<SidebarState>({
  open: false,
  locked: false,
  flying: false,
  registerWordmark: () => {},
  toggle: () => {},
  close: () => {},
  peek: () => {},
  unpeek: () => {},
});
