import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  HandshakeIcon,
  LogOutIcon,
  PaletteIcon,
  SunMoonIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ThemeSelector } from "@/components/theme-selector";
import { nextTheme } from "@/lib/theme-context";
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

const LINKS = [
  { label: "Studio", to: "/studio", icon: PaletteIcon },
  { label: "Students", to: "/students", icon: UsersIcon },
  { label: "Groups", to: "/groups", icon: UsersRoundIcon },
  { label: "Partners", to: "/partners", icon: HandshakeIcon },
  { label: "Finances", to: "/finances", icon: WalletIcon },
] as const;

type LinkTo = (typeof LINKS)[number]["to"];

/**
 * The app's top bar: the wordmark, and nothing else. It opens a command menu
 * (also on ⌘K) holding the page links, the theme selector, and the account.
 */
export function SiteNav() {
  const { session, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const email = session?.user.email ?? "";

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
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-4">
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
      >
        <CommandInput placeholder="Go to…" />

        <CommandList className="max-h-[400px]">
          <CommandEmpty>Nothing found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {LINKS.map(({ label, to, icon: Icon }) => (
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
