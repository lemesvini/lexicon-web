import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  HandshakeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LogOutIcon,
  NotebookPenIcon,
  PaletteIcon,
  SunMoonIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ThemeSelector } from "@/components/theme-selector";
import { nextTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type LinkTo =
  | "/"
  | "/studio"
  | "/modules"
  | "/students"
  | "/groups"
  | "/partners"
  | "/finances"
  | "/corrections"
  | "/learn"
  | "/homework"
  | "/change-password";

type NavLink = { label: string; to: LinkTo; icon: LucideIcon };

/** The content columns pages lay themselves out in. Spelled out rather than
 *  interpolated, because Tailwind only ships classes it can see in the source. */
const COLUMN = {
  wide: "max-w-6xl",
  narrow: "max-w-3xl",
} as const;

const COMPUTER_QUERY = "(pointer: fine) and (hover: hover)";

const ADMIN_LINKS: readonly NavLink[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboardIcon },
  { label: "Studio", to: "/studio", icon: PaletteIcon },
  { label: "Modules", to: "/modules", icon: LibraryIcon },
  { label: "Students", to: "/students", icon: UsersIcon },
  { label: "Corrections", to: "/corrections", icon: ClipboardCheckIcon },
  { label: "Groups", to: "/groups", icon: UsersRoundIcon },
  { label: "Partners", to: "/partners", icon: HandshakeIcon },
  { label: "Finances", to: "/finances", icon: WalletIcon },
];

// A student's whole app is their module, so their menu is that plus the account
// items every user gets.
const STUDENT_LINKS: readonly NavLink[] = [
  { label: "My module", to: "/learn", icon: GraduationCapIcon },
  { label: "Homework", to: "/homework", icon: NotebookPenIcon },
  { label: "Change password", to: "/change-password", icon: KeyRoundIcon },
];

/**
 * The app's top bar: the wordmark, and a way back out of a page that has one.
 * The wordmark opens a command menu (also on ⌘K) holding the page links, the
 * theme selector, and the account.
 *
 * The back arrow lives here rather than in each page's own header so that it is
 * always in the same place — a control that moves between pages is one the
 * reader has to find again every time.
 */
export function SiteNav({
  backTo,
  backLabel = "Back",
  align = "wide",
}: {
  /** Where the back arrow goes. Omitted on a page that is a destination. */
  backTo?: LinkTo;
  /** Its accessible name — it has no visible text. */
  backLabel?: string;
  /**
   * Which content column the back arrow lines up with — the page's own
   * `max-w-*`, so the arrow sits directly above the heading beneath it rather
   * than out in the margin. Only affects the arrow: the wordmark is centred on
   * the viewport either way.
   */
  align?: keyof typeof COLUMN;
} = {}) {
  const { session, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const email = session?.user.email ?? "";
  const links = profile?.role === "admin" ? ADMIN_LINKS : STUDENT_LINKS;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleNavigate = (to: LinkTo) => {
    setOpen(false);
    void navigate({ to });
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    void navigate({ to: "/login", search: { redirect: undefined } });
  };

  return (
    <header className="sticky top-0 z-40  bg-background/80 backdrop-blur">
      {/* The wordmark is centred on the viewport; the arrow is pinned to the
          left edge of the page's own content column, which is a different box.
          Hence two overlaid containers rather than one flex row — a row would
          have to choose which of the two to centre on. */}
      <div className="relative flex h-14 items-center justify-center">
        {backTo && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 mx-auto flex px-4",
              COLUMN[align],
            )}
          >
            <Button
              variant="outline"
              size="icon"
              asChild
              className="pointer-events-auto rounded-full"
            >
              <Link to={backTo} aria-label={backLabel}>
                <ArrowLeftIcon />
              </Link>
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the command menu"
          aria-keyshortcuts="Meta+K Control+K"
          className="group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* The hover state fades the fill to foreground and the glyph outline
              in to primary. The stroke width is always set so only its colour
              animates — animating the width would shift the letterforms. */}
          <span className="font-display text-4xl leading-none text-primary">
            lexicon
          </span>
        </button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command menu"
        description="Jump to a page, switch the theme, or sign out."
        showCloseButton={false}
        className="max-w-lg rounded-2xl"
        onOpenAutoFocus={(event) => {
          // Focusing the input on a touch device throws the on-screen keyboard
          // over the very list the menu exists to show, and there you tap a row
          // rather than type. Machines with a mouse keep the ⌘K-then-type flow.
          if (!window.matchMedia(COMPUTER_QUERY).matches) event.preventDefault();
        }}
      >
        <CommandInput placeholder="Go to…" />

        <CommandList className="max-h-[400px]">
          <CommandEmpty>Nothing found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {links.map(({ label, to, icon: Icon }) => (
              <CommandItem key={to} value={label} onSelect={() => handleNavigate(to)}>
                <Icon />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Preferences">
            <CommandItem
              value="Theme"
              keywords={["appearance", "light", "dark", "system"]}
              onSelect={() => setTheme(nextTheme(theme))}
              className="py-1"
            >
              <SunMoonIcon />
              Theme
              {/* The segmented buttons handle their own clicks, so keep them
                  from also selecting the row. */}
              <span
                className="ml-auto"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ThemeSelector />
              </span>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Account">
            <CommandItem
              value="Sign out"
              keywords={["log out", "account", email]}
              onSelect={handleSignOut}
            >
              <LogOutIcon />
              Sign out
              {email && (
                <CommandShortcut className="min-w-0 truncate tracking-normal">
                  Logged in as <span className="text-foreground">{email}</span>
                </CommandShortcut>
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
