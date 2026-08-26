import { createFileRoute } from "@tanstack/react-router";

import { GroupStudioPage } from "@/features/groups/components/group-studio-page";
import { requireAdvancedStudio } from "@/lib/route-guards";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/group/$groupId/",
)({
  // The same per-teacher permission the advanced editor is behind: this page is
  // the way into it, and everything it offers writes a group's own copy.
  beforeLoad: requireAdvancedStudio,
  component: GroupStudioRoute,
});

function GroupStudioRoute() {
  const { groupId } = Route.useParams();

  // Keyed on the group so nothing transient follows you from one to the next —
  // the same reason the group page is. The page draws its own frame: the top bar
  // carries the group's name, which only the page has loaded.
  return <GroupStudioPage key={groupId} groupId={groupId} />;
}
