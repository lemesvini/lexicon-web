import { createFileRoute } from "@tanstack/react-router";
import { CardNav, type CardNavItem } from "@/components/card-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/dev-preview")({
  component: Preview,
});

const NAV_ITEMS: CardNavItem[] = [
  { label: "Students", links: [{ label: "View students", to: "/students" }] },
  { label: "Groups", links: [{ label: "View groups", to: "/groups" }] },
  { label: "Partners", links: [{ label: "View partners", to: "/partners" }] },
];

function Preview() {
  return (
    <div className="relative h-svh bg-background text-foreground">
      <CardNav
        logoText="lexicon"
        items={NAV_ITEMS}
        avatarButton={
          <span className="flex size-10 items-center justify-center rounded-full border border-input bg-primary/40 text-sm font-medium">
            V
          </span>
        }
        userPanel={
          <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4 max-md:h-auto">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-input bg-primary/40 text-base font-medium">
                V
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground">
                  Vinicius Lemes
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  vinicius.lemes@epicora.com.br
                </span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        }
      />
    </div>
  );
}
