# CardNav Homepage Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<header>` on the homepage with a GSAP-animated `CardNav` pill component (ported from reactbits), restyled with this app's Tailwind design tokens.

**Architecture:** One new self-contained component (`src/components/card-nav.tsx`) that owns its own GSAP animation lifecycle via refs and `useLayoutEffect`, taking nav content and a right-side slot as props. The homepage route (`src/routes/_authenticated/index.tsx`) becomes the sole consumer, passing in the Students/Groups/Partners links and the existing avatar markup.

**Tech Stack:** React 19, TanStack Router, Tailwind CSS v4 (existing design tokens), GSAP (new dependency), lucide-react (existing dependency).

## Global Constraints

- No test runner is configured in this project (no vitest/jest/testing-library in `package.json`). Per the spec's Testing section, verification is manual via the dev server — there are no automated test steps in this plan.
- Styling must use the existing Tailwind design tokens (`bg-card`, `text-card-foreground`, `border-border`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `font-display`) so light/dark mode works automatically — no hardcoded hex colors.
- Nav links use TanStack Router's `Link`, not raw `<a href>`.
- Only the homepage (`src/routes/_authenticated/index.tsx`) is touched. `login.tsx` and other routes are out of scope.
- All 3 expanded cards share one subtle background — no per-card accent colors.
- The right-side slot renders the existing avatar circle, not a CTA button, and stays visible on the mobile breakpoint.

---

### Task 1: Create the `CardNav` component

**Files:**
- Modify: `package.json` (adds `gsap` dependency via `pnpm add`)
- Create: `src/components/card-nav.tsx`

**Interfaces:**
- Produces: `CardNav` (named export, `src/components/card-nav.tsx`), plus exported types `CardNavLink = { label: string; to: string }` and `CardNavItem = { label: string; links: CardNavLink[] }`.
  Component props: `{ logoText: string; items: CardNavItem[]; rightSlot?: React.ReactNode; className?: string; ease?: string }`.
  Task 2 imports `CardNav`, `CardNavItem`, `CardNavLink` from `@/components/card-nav`.

- [ ] **Step 1: Install gsap**

Run: `pnpm add gsap`
Expected: `package.json` `dependencies` gains a `"gsap": "^3.15.0"` (or newer patch) entry; install completes with no errors.

- [ ] **Step 2: Create `src/components/card-nav.tsx`**

```tsx
import { useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ArrowUpRight } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export type CardNavLink = {
  label: string
  to: string
}

export type CardNavItem = {
  label: string
  links: CardNavLink[]
}

type CardNavProps = {
  logoText: string
  items: CardNavItem[]
  rightSlot?: React.ReactNode
  className?: string
  ease?: string
}

export function CardNav({
  logoText,
  items,
  rightSlot,
  className,
  ease = "power3.out",
}: CardNavProps) {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<Array<HTMLDivElement | null>>([])
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  const calculateHeight = () => {
    const navEl = navRef.current
    if (!navEl) return 260

    const isMobile = window.matchMedia("(max-width: 768px)").matches
    if (isMobile) {
      const contentEl = navEl.querySelector<HTMLElement>(".card-nav-content")
      if (contentEl) {
        const wasVisibility = contentEl.style.visibility
        const wasPointerEvents = contentEl.style.pointerEvents
        const wasPosition = contentEl.style.position
        const wasHeight = contentEl.style.height

        contentEl.style.visibility = "visible"
        contentEl.style.pointerEvents = "auto"
        contentEl.style.position = "static"
        contentEl.style.height = "auto"

        contentEl.offsetHeight

        const topBar = 60
        const padding = 16
        const contentHeight = contentEl.scrollHeight

        contentEl.style.visibility = wasVisibility
        contentEl.style.pointerEvents = wasPointerEvents
        contentEl.style.position = wasPosition
        contentEl.style.height = wasHeight

        return topBar + contentHeight + padding
      }
    }
    return 260
  }

  const createTimeline = () => {
    const navEl = navRef.current
    if (!navEl) return null

    gsap.set(navEl, { height: 60, overflow: "hidden" })
    gsap.set(cardsRef.current, { y: 50, opacity: 0 })

    const tl = gsap.timeline({ paused: true })

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease,
    })

    tl.to(
      cardsRef.current,
      { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 },
      "-=0.1"
    )

    return tl
  }

  useLayoutEffect(() => {
    const tl = createTimeline()
    tlRef.current = tl

    return () => {
      tl?.kill()
      tlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items])

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return

      if (isExpanded) {
        const newHeight = calculateHeight()
        gsap.set(navRef.current, { height: newHeight })

        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) {
          newTl.progress(1)
          tlRef.current = newTl
        }
      } else {
        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) {
          tlRef.current = newTl
        }
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const toggleMenu = () => {
    const tl = tlRef.current
    if (!tl) return
    if (!isExpanded) {
      setIsHamburgerOpen(true)
      setIsExpanded(true)
      tl.play(0)
    } else {
      setIsHamburgerOpen(false)
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false))
      tl.reverse()
    }
  }

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el
  }

  return (
    <div
      className={cn(
        "absolute left-1/2 top-5 z-50 w-[90%] max-w-[800px] -translate-x-1/2 md:top-8",
        className
      )}
    >
      <nav
        ref={navRef}
        className="relative block h-[60px] overflow-hidden rounded-xl border border-border bg-card shadow-lg will-change-[height]"
      >
        <div className="absolute inset-x-0 top-0 z-[2] flex h-[60px] items-center justify-between px-4">
          <div
            className="flex h-full cursor-pointer flex-col items-center justify-center gap-1.5"
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                toggleMenu()
              }
            }}
            role="button"
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            aria-expanded={isExpanded}
            tabIndex={0}
          >
            <span
              className={cn(
                "h-0.5 w-[26px] bg-foreground transition-transform duration-200",
                isHamburgerOpen && "translate-y-[5px] rotate-45"
              )}
            />
            <span
              className={cn(
                "h-0.5 w-[26px] bg-foreground transition-transform duration-200",
                isHamburgerOpen && "-translate-y-[5px] -rotate-45"
              )}
            />
          </div>

          <span className="font-display text-2xl text-foreground md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
            {logoText}
          </span>

          <div className="flex h-full items-center">{rightSlot}</div>
        </div>

        <div
          className={cn(
            "card-nav-content invisible absolute inset-x-0 top-[60px] bottom-0 z-[1] flex items-end gap-3 p-2 pointer-events-none max-md:flex-col max-md:items-stretch",
            isExpanded && "visible pointer-events-auto"
          )}
          aria-hidden={!isExpanded}
        >
          {items.slice(0, 3).map((item, idx) => (
            <div
              key={item.label}
              ref={setCardRef(idx)}
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
        </div>
      </nav>
    </div>
  )
}
```

- [ ] **Step 3: Type-check the new file**

Run: `pnpm run build`
Expected: exits 0. Output ends with Vite's `✓ built in ...` line and no TypeScript errors. (The component isn't imported anywhere yet, but `tsc -b` still checks every file under `src/`.)

(No commit step — `lexicon-web` is not a git repository.)

---

### Task 2: Wire `CardNav` into the homepage

**Files:**
- Modify: `src/routes/_authenticated/index.tsx`

**Interfaces:**
- Consumes: `CardNav`, `CardNavItem` from `@/components/card-nav` (Task 1).

- [ ] **Step 1: Replace the header and adjust layout**

Current content of `src/routes/_authenticated/index.tsx`:

```tsx
import { Card } from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="h-svh flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-display text-4xl">lexicon</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="p-2 bg-primary/40 border border-input rounded-full w-10 h-10 items-center justify-center flex text-sm font-medium">
            U
          </span>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <Card className="w-full max-w-2xl p-6">
          <h1 className="text-2xl font-semibold">Welcome to Lexicon!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is a placeholder page for authenticated users. You can replace
            this content with your own components and functionality.
          </p>
        </Card>
      </div>
    </div>
  );
}
```

Replace it with:

```tsx
import { Card } from "@/components/ui/card";
import { CardNav, type CardNavItem } from "@/components/card-nav";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

const NAV_ITEMS: CardNavItem[] = [
  { label: "Students", links: [{ label: "View students", to: "/students" }] },
  { label: "Groups", links: [{ label: "View groups", to: "/groups" }] },
  { label: "Partners", links: [{ label: "View partners", to: "/partners" }] },
];

function HomePage() {
  return (
    <div className="relative h-svh flex flex-col bg-background text-foreground">
      <CardNav
        logoText="lexicon"
        items={NAV_ITEMS}
        rightSlot={
          <span className="p-2 bg-primary/40 border border-input rounded-full w-10 h-10 items-center justify-center flex text-sm font-medium">
            U
          </span>
        }
      />
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 pt-28">
        <Card className="w-full max-w-2xl p-6">
          <h1 className="text-2xl font-semibold">Welcome to Lexicon!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is a placeholder page for authenticated users. You can replace
            this content with your own components and functionality.
          </p>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm run build`
Expected: exits 0, no TypeScript errors, Vite build succeeds.

(No commit step — `lexicon-web` is not a git repository.)

---

### Task 3: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `pnpm run dev`
Expected: prints a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Verify collapsed state and logo**

Open the app in a browser, log in if needed to reach `/`. Confirm a centered floating pill appears near the top of the page showing a hamburger icon on the left, the `lexicon` wordmark centered, and the round "U" avatar on the right. Confirm the welcome card below is not covered by the pill.

- [ ] **Step 3: Verify expand/collapse animation**

Click the hamburger icon. Confirm the pill animates open (height grows, the two hamburger bars rotate into an X) revealing 3 cards labeled "Students", "Groups", "Partners", each fading/sliding up with a slight stagger. Click the hamburger again and confirm it animates closed (bars rotate back, cards disappear, pill collapses to 60px).

- [ ] **Step 4: Verify links navigate**

With the nav expanded, click each of the "View students" / "View groups" / "View partners" links in turn (re-opening the nav between clicks) and confirm each navigates to `/students`, `/groups`, `/partners` respectively.

- [ ] **Step 5: Verify dark mode**

Open the browser devtools console and run:

```js
localStorage.setItem('lexicon-theme', 'dark')
location.reload()
```

Confirm the pill, cards, and text all switch to the app's dark palette (no white/black hardcoded backgrounds) and remain legible. Repeat with `'light'` to switch back.

- [ ] **Step 6: Verify mobile breakpoint**

Resize the browser (or use devtools device toolbar) to a width under 768px. Confirm: the avatar is still visible in the top bar, and expanding the nav stacks the 3 cards vertically instead of side-by-side.
