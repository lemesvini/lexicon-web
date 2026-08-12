import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type CardNavLink = {
  label: string;
  to: string;
};

export type CardNavItem = {
  label: string;
  links: CardNavLink[];
};

type Panel = "nav" | "user";

type CardNavProps = {
  logoText: string;
  items: CardNavItem[];
  avatarButton: React.ReactNode;
  userPanel: React.ReactNode;
  className?: string;
  ease?: string;
};

export function CardNav({
  logoText,
  items,
  avatarButton,
  userPanel,
  className,
  ease = "power3.out",
}: CardNavProps) {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const measureOpenHeight = () => {
    const contentEl = contentRef.current;
    if (!contentEl) return 60;

    const prevStyle = {
      visibility: contentEl.style.visibility,
      pointerEvents: contentEl.style.pointerEvents,
      position: contentEl.style.position,
      height: contentEl.style.height,
    };

    contentEl.style.visibility = "visible";
    contentEl.style.pointerEvents = "auto";
    contentEl.style.position = "static";
    contentEl.style.height = "auto";

    contentEl.offsetHeight;

    const contentHeight = contentEl.scrollHeight;

    contentEl.style.visibility = prevStyle.visibility;
    contentEl.style.pointerEvents = prevStyle.pointerEvents;
    contentEl.style.position = prevStyle.position;
    contentEl.style.height = prevStyle.height;

    return 60 + contentHeight + 16;
  };

  const playOpen = () => {
    const navEl = navRef.current;
    const contentEl = contentRef.current;
    if (!navEl || !contentEl) return;

    tlRef.current?.kill();

    const cardEls = Array.from(contentEl.children);
    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardEls, { y: 50, opacity: 0 });

    const tl = gsap.timeline();
    tl.to(navEl, { height: measureOpenHeight, duration: 0.4, ease });
    tl.to(
      cardEls,
      { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 },
      "-=0.1",
    );

    tlRef.current = tl;
  };

  const playClose = (onComplete?: () => void) => {
    const navEl = navRef.current;
    const contentEl = contentRef.current;
    if (!navEl) {
      setOpenPanel(null);
      onComplete?.();
      return;
    }

    tlRef.current?.kill();

    const cardEls = contentEl ? Array.from(contentEl.children) : [];
    const tl = gsap.timeline({
      onComplete: () => {
        setOpenPanel(null);
        onComplete?.();
      },
    });
    tl.to(cardEls, { y: 20, opacity: 0, duration: 0.2, ease });
    tl.to(navEl, { height: 60, duration: 0.3, ease }, "-=0.05");

    tlRef.current = tl;
  };

  useLayoutEffect(() => {
    if (openPanel) playOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  useLayoutEffect(() => {
    if (!openPanel) return;

    const handleResize = () => {
      if (!navRef.current) return;
      gsap.set(navRef.current, { height: measureOpenHeight() });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  const requestPanel = (panel: Panel) => {
    if (openPanel === panel) {
      playClose();
      return;
    }
    if (openPanel) {
      playClose(() => setOpenPanel(panel));
      return;
    }
    setOpenPanel(panel);
  };

  return (
    <div
      className={cn(
        "absolute left-1/2 top-5 z-50 w-[90%] max-w-[800px] -translate-x-1/2 md:top-8",
        className,
      )}
    >
      <nav
        ref={navRef}
        className="relative block h-[60px] overflow-hidden rounded-xl border border-border bg-card will-change-[height]"
      >
        <div className="absolute inset-x-0 top-0 z-[2] flex h-[60px] items-center justify-between px-4">
          <button
            type="button"
            onClick={() => requestPanel("nav")}
            aria-label={openPanel === "nav" ? "Close menu" : "Open menu"}
            aria-expanded={openPanel === "nav"}
            className="flex h-full flex-col items-center justify-center gap-1.5"
          >
            <span
              className={cn(
                "h-0.5 w-[26px] bg-foreground transition-transform duration-200",
                openPanel === "nav" && "translate-y-[5px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-0.5 w-[26px] bg-foreground transition-transform duration-200",
                openPanel === "nav" && "-translate-y-[5px] -rotate-45",
              )}
            />
          </button>

          <span className="font-display text-4xl text-primary md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
            {logoText}
          </span>

          <button
            type="button"
            onClick={() => requestPanel("user")}
            aria-label={
              openPanel === "user" ? "Close account menu" : "Open account menu"
            }
            aria-expanded={openPanel === "user"}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full",
              openPanel === "user" &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
          >
            {avatarButton}
          </button>
        </div>

        <div
          ref={contentRef}
          className={cn(
            "card-nav-content invisible absolute inset-x-0 bottom-0 top-[60px] z-[1] flex items-end gap-3 p-2 pointer-events-none max-md:flex-col max-md:items-stretch",
            openPanel && "visible pointer-events-auto",
          )}
          aria-hidden={!openPanel}
        >
          {openPanel === "nav" &&
            items.slice(0, 3).map((item) => (
              <div
                key={item.label}
                className="flex h-full min-w-0 flex-1 flex-col gap-2 rounded-lg border border-border bg-muted p-4 max-md:h-auto max-md:min-h-[60px] max-md:flex-none"
              >
                <div className="text-lg font-medium tracking-tight text-foreground">
                  {item.label}
                </div>
                <div className="mt-auto flex flex-col gap-0.5">
                  {item.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-opacity hover:opacity-75"
                    >
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          {openPanel === "user" && userPanel}
        </div>
      </nav>
    </div>
  );
}
