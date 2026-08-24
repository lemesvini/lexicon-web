import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import {
  GroupPage,
  toGroupTab,
  type GroupTab,
} from "@/features/groups/components/group-page";

type GroupSearch = { tab: GroupTab };

export const Route = createFileRoute("/_authenticated/_admin/groups/$groupId")({
  // The tab is in the URL so back, reload and a pasted link all land where they
  // were pointed. Anything unrecognised falls back to the register rather than
  // erroring — a stale link is not a broken page.
  validateSearch: (search: Record<string, unknown>): GroupSearch => ({
    tab: toGroupTab(search.tab),
  }),
  component: GroupDetailRoute,
});

function GroupDetailRoute() {
  const { groupId } = Route.useParams();
  const { tab } = Route.useSearch();

  // Keyed on the group so nothing transient — a half-typed date, an open
  // confirm — follows you from one group to the next.
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav backTo="/groups" backLabel="Back to groups" />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <GroupPage key={groupId} groupId={groupId} tab={tab} />
      </main>
    </div>
  );
}
