import { useContext } from "react";
import { SidebarContext } from "@/lib/sidebar-context";

/**
 * The floating sidebar's state. Safe to call outside the provider — the context
 * defaults to a no-op, so a header rendered on a signed-out page just gets a
 * menu button that does nothing rather than a crash.
 */
export function useSidebar() {
  return useContext(SidebarContext);
}
