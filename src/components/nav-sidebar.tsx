import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOutIcon, PanelLeftCloseIcon, SunMoonIcon } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { sectionsFor } from "@/lib/nav";
import { SidebarContext, type SidebarState } from "@/lib/sidebar-context";
import { ThemeSelector } from "@/components/theme-selector";
import { cn } from "@/lib/utils";

/** How long the panel waits after the pointer leaves before sliding away. Long
 *  enough to cross the gap between the edge strip and the panel, or to overshoot
 *  a row, without feeling stuck open. */
const CLOSE_DELAY_MS = 240;

/** The panel's slide, the wordmark's flight, and the header button fading out of
 *  its way. One number: they are the same movement seen from three places, and
 *  they have to land together. */
export const SLIDE_MS = 220;
const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Width of the invisible strip down the left edge that opens the panel. */
const EDGE = "w-4";

/** The panel's inset from the left edge, in px — Tailwind's `left-2`. Needed as
 *  a number because the closed position is the panel's own width plus this. */
const PANEL_INSET = 8;

const COMPUTER_QUERY = "(pointer: fine) and (hover: hover)";

/** The wordmark, at the one size it is ever drawn. Shared by the header, the
 *  panel and the copy that flies between them — the flight is a translation and
 *  nothing else, so all three have to agree. */
export const WORDMARK = "font-display text-4xl leading-none text-primary";

/** A wordmark in transit: where it starts, and how far it has to go. */
type Flight = { left: number; top: number; dx: number; dy: number };

/** How far the panel is currently slid, in px. Written by us as a plain pixel
 *  translate (see the panel's inline style) precisely so it can be read back
 *  without parsing a calc — and mid-slide this is the animated value, not the
 *  target, which is what makes the measurement below hold at any moment. */
function slideOffset(panel: HTMLElement): number {
  const translate = getComputedStyle(panel).translate;
  return translate === "none" ? 0 : (parseFloat(translate) || 0);
}

/**
 * Where an element inside the panel sits once the panel is open — its rect with
 * the panel's slide taken back out.
 *
 * Measuring it directly would give wherever the panel happens to be at that
 * instant, which during a slide is anywhere at all. Subtracting exactly the
 * offset the rect was measured under is self-correcting: mid-slide, settled, or
 * a frame before the transition has started, it returns the same answer.
 */
function restingPosition(panel: HTMLElement, child: HTMLElement) {
  const rect = child.getBoundingClientRect();
  return { left: rect.left - slideOffset(panel), top: rect.top };
}

/**
 * The app's navigation: a floating panel that lives off the left edge of the
 * screen and slides in over the page, the way Notion's collapsed sidebar does.
 *
 * Two ways in, and they behave differently on purpose:
 *
 *   hover   brush the left edge and it appears; move away and it goes. Nothing
 *           to click, nothing to put back — the reason it can afford to cover
 *           the page rather than push it aside.
 *   click   the menu button in the header (or ⌘K) locks it open, so it survives
 *           the pointer wandering off. Escape, a click away, or going somewhere
 *           closes it.
 *
 * It overlays rather than displaces: every page in this app lays itself out in a
 * centred column, and pushing that sideways on hover would reflow the whole page
 * under the reader's cursor.
 *
 * The wordmark is one mark in two places, so it travels between them rather than
 * being dropped in one and drawn in the other — see {@link Flight}.
 */
export function NavSidebarProvider({ children }: { children: React.ReactNode }) {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [locked, setLocked] = React.useState(false);
  const [peeking, setPeeking] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  const open = locked || peeking;

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const peek = React.useCallback(() => {
    cancelClose();
    setPeeking(true);
  }, [cancelClose]);

  const unpeek = React.useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPeeking(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  const close = React.useCallback(() => {
    cancelClose();
    setLocked(false);
    setPeeking(false);
  }, [cancelClose]);

  const toggle = React.useCallback(() => {
    cancelClose();
    setPeeking(false);
    setLocked((wasLocked) => !wasLocked);
  }, [cancelClose]);

  React.useEffect(() => cancelClose, [cancelClose]);

  // ⌘K keeps the shortcut the command menu had — the panel is where those links
  // live now. ⌘\ is Notion's, and costs one line to also accept.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key === "k" || key === "\\") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
      if (key === "escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle, close]);

  // The wordmark's flight --------------------------------------------------
  // Header and panel each hold a copy; only ever one of them is visible, and a
  // third, in fixed position above both, carries the eye from one to the other.

  const headerWordmark = React.useRef<HTMLElement | null>(null);
  const panelWordmark = React.useRef<HTMLSpanElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const [flight, setFlight] = React.useState<Flight | null>(null);
  const flyerRef = React.useRef<HTMLSpanElement | null>(null);

  const registerWordmark = React.useCallback((element: HTMLElement | null) => {
    headerWordmark.current = element;
  }, []);

  // The closed panel is parked its own width off the left edge. Kept in state,
  // in px, rather than as a `-translate-x-full` class: the flight measures
  // against this number, and a percentage would come back out of
  // getComputedStyle as an unresolved calc.
  const [panelWidth, setPanelWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const measure = () => setPanelWidth(panel.offsetWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [profile]);

  // Laid out before paint, so the copy that is about to be hidden is measured
  // where it still is.
  const firstRender = React.useRef(true);
  React.useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const header = headerWordmark.current;
    const panel = panelRef.current;
    const slot = panelWordmark.current;
    // No header on this page (several lay themselves out without one), so there
    // is nowhere to fly from: the panel's copy simply arrives with the panel.
    if (!header || !panel || !slot) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const headerRect = header.getBoundingClientRect();
    const slotRect = restingPosition(panel, slot);
    const [origin, to] = open ? [headerRect, slotRect] : [slotRect, headerRect];

    // Toggled again mid-flight (⌘K ⌘K): pick the mark up where it currently is
    // rather than at the end it never reached, so it turns around instead of
    // jumping back to start the return trip.
    const from = flyerRef.current?.getBoundingClientRect() ?? origin;

    setFlight({
      left: from.left,
      top: from.top,
      dx: to.left - from.left,
      dy: to.top - from.top,
    });
  }, [open]);

  React.useLayoutEffect(() => {
    const flyer = flyerRef.current;
    if (!flight || !flyer) return;

    const animation = flyer.animate(
      [
        { transform: "translate(0px, 0px)" },
        { transform: `translate(${flight.dx}px, ${flight.dy}px)` },
      ],
      { duration: SLIDE_MS, easing: SLIDE_EASE, fill: "forwards" },
    );

    // `catch` is load-bearing: cancelling on cleanup rejects this promise, and
    // an unhandled rejection is what a fast double-click would produce.
    animation.finished.then(() => setFlight(null)).catch(() => {});
    return () => animation.cancel();
  }, [flight]);

  const state = React.useMemo<SidebarState>(
    () => ({
      open,
      locked,
      flying: flight !== null,
      registerWordmark,
      toggle,
      close,
      peek,
      unpeek,
    }),
    [open, locked, flight, registerWordmark, toggle, close, peek, unpeek],
  );

  // The edge strip is for mice. On a touch screen there is no hover to detect,
  // and a 16px live strip down the side of every page would swallow swipes.
  const [hoverCapable, setHoverCapable] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia(COMPUTER_QUERY);
    const sync = () => setHoverCapable(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Not on the projected screen: /present is what the room is looking at, and a
  // menu that opens because the presenter's mouse drifted left is a menu the
  // whole class sees. ⌘K still works for whoever is driving.
  const projecting = useRouterState({
    select: (state) => state.location.pathname.startsWith("/present"),
  });

  const email = session?.user.email ?? "";
  const sections = sectionsFor(profile?.role);

  const handleSignOut = async () => {
    close();
    await signOut();
    void navigate({ to: "/login", search: { redirect: undefined } });
  };

  return (
    <SidebarContext.Provider value={state}>
      {children}

      {/* Signed out — on /login, or for the moment before the profile lands —
          there is nowhere to navigate to yet. */}
      {profile && (
        <>
          {hoverCapable && !projecting && (
            <div
              aria-hidden
              onMouseEnter={peek}
              // Leaving the strip has to arm the close as well, or a pointer
              // that brushes the edge and then goes back to the page leaves the
              // panel standing there with nothing to dismiss it. Moving into the
              // panel instead re-enters `peek`, which cancels it.
              onMouseLeave={unpeek}
              className={cn("fixed inset-y-0 left-0 z-40", EDGE)}
            />
          )}

          {/* Catches the click that dismisses a locked panel. Deliberately not
              dimmed: this is a menu the reader opened over their page, not a
              modal that has taken the page away from them. */}
          {locked && (
            <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          )}

          <nav
            ref={panelRef}
            aria-label="Main"
            inert={!open}
            onMouseEnter={peek}
            onMouseLeave={unpeek}
            style={{
              transitionDuration: `${SLIDE_MS}ms`,
              translate: open ? "0px" : `-${panelWidth + PANEL_INSET}px`,
            }}
            className={cn(
              "fixed inset-y-2 left-2 z-50 flex w-64 flex-col rounded-xl border bg-popover text-popover-foreground shadow-xl",
              // `translate`, not `transform`: that is the property Tailwind's
              // translate utilities set, and the one the inline style above
              // animates. Naming `transform` here would transition nothing.
              "transition-[translate,opacity] ease-out motion-reduce:transition-none",
              open ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="flex items-center justify-between gap-1 px-3 pt-2 pb-1">
              <span
                ref={panelWordmark}
                className={cn(WORDMARK, flight && "invisible")}
              >
                lexicon
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close the menu"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <PanelLeftCloseIcon className="size-4" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-2">
              {sections.map((section) => (
                <div
                  key={section.label ?? "menu"}
                  className="flex flex-col gap-1 pb-2 last:pb-0"
                >
                  {section.label && (
                    <p className="px-2 pt-2 text-xs font-medium text-muted-foreground/70">
                      {section.label}
                    </p>
                  )}

                  {section.links.map(({ label, to, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={close}
                      // Every page sits under "/", so only Lessons can afford to
                      // match loosely — the rest stay lit on their own
                      // sub-routes (/studio while editing a lesson, say).
                      activeOptions={{ exact: to === "/" }}
                      activeProps={{ className: "bg-accent text-foreground" }}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Icon className="size-4 shrink-0 text-current" />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t p-2">
              <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-2.5">
                  <SunMoonIcon className="size-4 shrink-0" />
                  Theme
                </span>
                <ThemeSelector />
              </div>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOutIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block leading-tight">Sign out</span>
                  {email && (
                    <span className="block truncate text-xs text-muted-foreground/70">
                      {email}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </nav>

          {/* The one in transit. Above the panel it is heading into, so it is
              never clipped by the rounded corner it is about to sit behind. */}
          {flight && (
            <span
              ref={flyerRef}
              aria-hidden
              className={cn(
                "pointer-events-none fixed z-[60] whitespace-nowrap",
                WORDMARK,
              )}
              style={{ left: flight.left, top: flight.top }}
            >
              lexicon
            </span>
          )}
        </>
      )}
    </SidebarContext.Provider>
  );
}
