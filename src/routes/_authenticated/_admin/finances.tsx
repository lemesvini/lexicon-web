import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { FinancesTable } from "@/features/finance/components/finances-table";

export const Route = createFileRoute("/_authenticated/_admin/finances")({
  component: FinancesPage,
});

function FinancesPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Finances</h1>
          <p className="text-sm text-muted-foreground">
            What each student pays a month, and how many classes a week it
            covers.
          </p>
        </div>

        <FinancesTable />
      </main>
    </div>
  );
}
