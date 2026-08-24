import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/_admin/partners")({
  beforeLoad: requireAdmin,
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
        </div>
      </main>
    </div>
  );
}
