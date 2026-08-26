import { createFileRoute } from "@tanstack/react-router";

import { GroupCopyEditor } from "@/features/studio/components/group-copy-editor";
import { requireAdvancedStudio } from "@/lib/route-guards";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/group/$groupId/material/$lessonId",
)({ beforeLoad: requireAdvancedStudio, component: GroupMaterialRoute });

function GroupMaterialRoute() {
  const { groupId, lessonId } = Route.useParams();

  // Keyed on both, so moving between two copies remounts rather than carrying
  // one document's editor state onto the other.
  return (
    <GroupCopyEditor
      key={`${groupId}/${lessonId}`}
      kind="material"
      groupId={groupId}
      documentId={lessonId}
    />
  );
}
