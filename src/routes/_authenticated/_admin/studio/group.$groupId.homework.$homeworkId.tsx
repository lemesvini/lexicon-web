import { createFileRoute } from "@tanstack/react-router";

import { GroupCopyEditor } from "@/features/studio/components/group-copy-editor";
import { requireAdvancedStudio } from "@/lib/route-guards";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/group/$groupId/homework/$homeworkId",
)({ beforeLoad: requireAdvancedStudio, component: GroupHomeworkRoute });

function GroupHomeworkRoute() {
  const { groupId, homeworkId } = Route.useParams();

  return (
    <GroupCopyEditor
      key={`${groupId}/${homeworkId}`}
      kind="homework"
      groupId={groupId}
      documentId={homeworkId}
    />
  );
}
