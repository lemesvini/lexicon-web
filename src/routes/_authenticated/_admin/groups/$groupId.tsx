import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { GroupPage } from "@/features/groups/components/group-page";

export const Route = createFileRoute("/_authenticated/_admin/groups/$groupId")({
  // No search params: the page is the register, and everything the old `?tab=`
  // pointed at is in the group's studio now. An old link keeps working — an
  // unvalidated param is dropped, not an error.
  component: GroupDetailRoute,
});

function GroupDetailRoute() {
  const { groupId } = Route.useParams();

  // Keyed on the group so nothing transient — a half-typed date, an open
  // confirm — follows you from one group to the next.
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav backTo="/groups" backLabel="Back to groups" />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <GroupPage key={groupId} groupId={groupId} />
      </main>
    </div>
  );
}
