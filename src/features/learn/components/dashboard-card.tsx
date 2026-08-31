import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import type { LinkTo } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * One destination on the student's home screen.
 *
 * Deliberately the same object as the module tiles on the staff homepage (see
 * @/features/homepage/components/module-card): a square, a flat jade tint, the
 * icon at the top and the name in the display face at the bottom. A student and
 * a teacher opening this app should be looking at the same piece of furniture.
 *
 * All four are the same colour. They are the app's four doors, not a ranking —
 * tinting one of them louder because homework is owed would make the row read
 * as an alert every day of term. What is owed is said in `badge` instead.
 *
 * The copy under each name is in Portuguese: this is the one screen a student
 * opens before they have the English to read it.
 */
export function DashboardCard({
  to,
  icon: Icon,
  title,
  description,
  badge,
}: {
  to: LinkTo;
  icon: LucideIcon;
  title: string;
  /** One line under the name, in Portuguese. */
  description: string;
  /** A word or two in the top corner — a count, where there is one. */
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex aspect-square w-full flex-col justify-between overflow-hidden rounded-xl border p-4 text-left shadow-sm",
        "border-primary/15 bg-primary/10 text-primary",
        "transition-all hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-6 opacity-90" />
        {badge && (
          <span className="rounded-full border border-current/25 bg-black/5 px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-90">
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        <h2 className="font-display text-xl leading-tight tracking-tight break-words sm:text-2xl">
          {title}
        </h2>
        <p className="line-clamp-2 font-montserrat text-sm opacity-80">
          {description}
        </p>
      </div>
    </Link>
  );
}
