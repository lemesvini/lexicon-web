import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { GroupsBoard } from "@/features/groups/components/groups-board";

export const Route = createFileRoute("/_authenticated/_admin/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Who is taught together, the lesson they’re on, and who turned up.
          </p>
        </div>

        <GroupsBoard />
      </main>
    </div>
  );
}
