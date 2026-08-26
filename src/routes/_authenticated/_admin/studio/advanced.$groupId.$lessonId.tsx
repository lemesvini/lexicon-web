import * as React from "react";
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { requireAdvancedStudio } from "@/lib/route-guards";
import type { Lesson } from "@/lib/lessons";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancedStudio } from "@/features/studio/use-advanced-studio";
import { StudioCanvas } from "@/features/studio/components/studio-canvas";
import { AdvancedMetaEditor } from "@/features/studio/components/advanced-meta-editor";
import { AdvancedContextDrawer } from "@/features/studio/components/advanced-context-drawer";
import { isBase, rebaseOnto } from "@/features/studio/advanced-context";
import { insertSuggestion } from "@/features/studio/insert-suggestion";
import { studioKind } from "@/features/studio/kinds";
import { openLessonForEditing } from "@/features/studio/data/open-lesson";
import {
  fetchGroupLesson,
  saveGroupLesson,
} from "@/features/groups/data/group-lessons";
import { fetchGroup, type GroupRow } from "@/features/groups/data/groups";
import { listCloudLessons } from "@/lib/lessons-cloud";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/advanced/$groupId/$lessonId",
)({
  // Permission granted per teacher by the admin (teachers list → row menu).
  // Sent home rather than shown a refusal: there's nothing for them to do here.
  beforeLoad: requireAdvancedStudio,
  component: AdvancedEditorRoute,
});

function AdvancedEditorRoute() {
  const { groupId, lessonId } = Route.useParams();
  // Keyed on both, so moving between two copies remounts rather than carrying
  // one document's editor state onto the other.
  return (
    <AdvancedEditor
      key={`${groupId}/${lessonId}`}
      groupId={groupId}
      lessonId={lessonId}
    />
  );
}

type State = {
  phase: "loading" | "ready" | "missing";
  group: GroupRow | null;
  /** The shared lesson as it stands now — what a rebase would rebuild from. */
  base: Lesson | null;
  /** `lessons.updated_at` when this copy was made. */
  baseSyncedAt: string | null;
  /** The shared lesson's last save, for spotting drift. */
  baseUpdatedAt: string | null;
  scheduledOn: string | null;
};

/**
 * One group's copy of one lesson.
 *
 * What makes this editor different from the other three is what it refuses. The
 * base slides are locked — no delete, no reorder, no editing their blocks — and
 * everything added here is stamped `advancedContext: true` on the way in. A class
 * gets to add to the lesson it is taught; it does not get to fork it, because a
 * fork drifts silently and the next teacher to open the shared lesson would have
 * no idea which classes had quietly stopped following it.
 *
 * The copy is made in the group's studio, not here — which is why a missing
 * row sends you back there rather than offering to create one. There is no
 * meaningful "new" state for a document that only exists as a copy of another.
 */
function AdvancedEditor({
  groupId,
  lessonId,
}: {
  groupId: string;
  lessonId: string;
}) {
  const studio = useAdvancedStudio();
  const { load } = studio;
  const router = useRouter();
  const navigate = useNavigate();

  /**
   * Back to wherever this was opened from.
   *
   * A copy is reached from two places — the group's studio and the main Studio
   * library — so there is no one right destination, and history is the only thing
   * that knows which it was. The fallback is not optional: on a pasted link or a
   * refresh there is nothing to go back to, and `history.back()` would either sit
   * there doing nothing or walk the user out of the app.
   */
  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void navigate({ to: "/studio/group/$groupId", params: { groupId } });
  };

  const [state, setState] = React.useState<State>({
    phase: "loading",
    group: null,
    base: null,
    baseSyncedAt: null,
    baseUpdatedAt: null,
    scheduledOn: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchGroup(groupId),
      fetchGroupLesson(groupId, lessonId),
      openLessonForEditing(lessonId),
      listCloudLessons(),
    ])
      .then(([group, copy, base, summaries]) => {
        if (cancelled) return;

        if (!group || !copy) {
          setState((s) => ({ ...s, phase: "missing" }));
          return;
        }

        load(copy.document);
        setState({
          phase: "ready",
          group,
          base: base ?? null,
          baseSyncedAt: copy.baseSyncedAt,
          baseUpdatedAt:
            summaries.find((lesson) => lesson.id === lessonId)?.updatedAt ??
            null,
          scheduledOn: copy.scheduledOn,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, phase: "missing" }));
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, lessonId, load]);

  const save = async () => {
    // `baseSyncedAt` is passed through untouched: saving your own additions is
    // not the same as taking on whatever changed in the shared lesson meanwhile.
    // Only a rebase moves that mark.
    await saveGroupLesson(
      groupId,
      lessonId,
      studio.document,
      state.baseSyncedAt,
    );
  };

  const baseIsNewer =
    !!state.baseSyncedAt &&
    !!state.baseUpdatedAt &&
    state.baseUpdatedAt > state.baseSyncedAt;

  const refreshFromBase = () => {
    if (!state.base) return;
    if (
      !window.confirm(
        "Rebuild this copy on the current version of the lesson? Your added blocks are kept; any that no longer have a slide to sit on are collected onto one at the end.",
      )
    ) {
      return;
    }
    load(rebaseOnto(state.base, studio.document));
    setState((s) => ({ ...s, baseSyncedAt: s.baseUpdatedAt }));
  };

  if (state.phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.phase === "missing" || !state.group) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          This group has no copy of “{lessonId}”. Copies are made in the group’s
          studio — assign the module there and it’ll show up.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/studio/group/$groupId" params={{ groupId }}>
            Back to the group’s studio
          </Link>
        </Button>
      </div>
    );
  }

  const group = state.group;

  return (
    <StudioCanvas
      studio={studio}
      label={studioKind("advanced").singular}
      railLayout="stacked"
      portable={false}
      back={{ label: "Back", onClick: goBack }}
      slideLocked={(slide) => isBase(slide.meta)}
      drawerLabel="LexStudio Agent"
      drawer={
        <AdvancedContextDrawer
          kind="lesson"
          groupId={groupId}
          documentId={lessonId}
          groupName={group.name}
          slides={studio.lesson.slides}
          onInsert={(suggestion) => insertSuggestion(studio, suggestion)}
        />
      }
      onSave={save}
      meta={
        <AdvancedMetaEditor
          group={group}
          lessonTitle={studio.lesson.meta.title}
          lessonUnit={studio.lesson.meta.unit}
          scheduledOn={state.scheduledOn}
        />
      }
      menuItems={
        baseIsNewer ? (
          <DropdownMenuItem onSelect={refreshFromBase}>
            Refresh from base
          </DropdownMenuItem>
        ) : null
      }
    />
  );
}
