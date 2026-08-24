import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/route-guards";
import { ModulesBoard } from "@/features/modules/components/modules-board";

export const Route = createFileRoute("/_authenticated/_admin/modules")({
  beforeLoad: requireAdmin,
  component: ModulesPage,
});

function ModulesPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="text-sm text-muted-foreground">
            The curriculum a student’s access is pinned to.
          </p>
        </div>

        <ModulesBoard />
      </main>
    </div>
  );
}
