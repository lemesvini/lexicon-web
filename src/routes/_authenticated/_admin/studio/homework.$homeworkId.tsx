import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import type { Lesson } from "@/lib/lessons";
import { EXERCISE_BLOCK_ORDER } from "@/features/blocks";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioLesson } from "@/features/studio/use-studio-lesson";
import { StudioCanvas } from "@/features/studio/components/studio-canvas";
import { HomeworkMetaEditor } from "@/features/studio/components/homework-meta-editor";
import { PublishToggle } from "@/features/studio/components/publish-toggle";
import {
  fetchHomework,
  saveHomework,
  setHomeworkStatus,
} from "@/features/studio/data/homework";
import type { PublishStatus } from "@/features/studio/data/publishing";
import { NEW_DOCUMENT_ID as NEW, studioKind } from "@/features/studio/kinds";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/homework/$homeworkId",
)({ component: HomeworkEditorRoute });

function HomeworkEditorRoute() {
  const { homeworkId } = Route.useParams();
  return <HomeworkEditor key={homeworkId} homeworkId={homeworkId} />;
}

function blankHomework(): Lesson {
  return {
    id: "",
    unit: "",
    module: "",
    title: "",
    context: "",
    minorCanDo: "",
    grammarFocus: [],
    classPlan: [],
    slides: [],
  };
}

type State = {
  /** "error" never renders the editor: a failed load shown as a blank canvas
   *  invites a Save that would overwrite the real homework with nothing. */
  phase: "loading" | "ready" | "error";
  /** Every lesson in the library, for the "attached to" picker. */
  lessons: CloudLessonSummary[];
  /** null while this homework has never been saved. */
  status: PublishStatus | null;
  /** True once saved: the id keys the row and can no longer be edited here. */
  saved: boolean;
};

function HomeworkEditor({ homeworkId }: { homeworkId: string }) {
  const navigate = useNavigate();
  const studio = useStudioLesson();
  const { load } = studio;

  const isNew = homeworkId === NEW;

  // `id` and `title` live in the document, exactly as they do for a lesson —
  // the columns of the same name are denormalized copies the save keeps in step,
  // so that the library can list homework without parsing every blob. Keeping a
  // second copy in component state instead would make the exported JSON say
  // something different from the row.
  //
  // The lesson link is the one field that is genuinely not part of the document:
  // it is a foreign key, and a document that named its own parent would be one
  // more pair of things to keep in step.
  const [lessonId, setLessonId] = React.useState<string | null>(null);

  const [state, setState] = React.useState<State>({
    phase: "loading",
    lessons: [],
    status: null,
    saved: false,
  });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      listCloudLessons(),
      isNew ? Promise.resolve(null) : fetchHomework(homeworkId),
    ])
      .then(([lessons, homework]) => {
        if (cancelled) return;

        if (homework) {
          // The columns win over the document's copies of them: they are what
          // the library lists and what the row is keyed by, so if the two ever
          // disagree the columns are the truth and this heals the document.
          load({
            ...homework.document,
            id: homework.id,
            title: homework.title,
          });
          setLessonId(homework.lessonId);
        } else {
          load({ ...blankHomework(), id: isNew ? "" : homeworkId });
        }

        setState({
          phase: "ready",
          lessons,
          status: homework?.status ?? null,
          // An id that isn't in the table yet is still editable — typing a URL
          // for a homework that doesn't exist starts a new one under that slug.
          saved: homework !== null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) => ({ ...s, phase: "error" }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [homeworkId, isNew, load, reloadKey]);

  const slug = studio.document.id.trim();
  const title = studio.document.title.trim();

  const save = async () => {
    if (slug === NEW) {
      throw new Error(
        `"${NEW}" is reserved for a homework that hasn't been saved yet — give this one another id.`,
      );
    }

    await saveHomework({
      id: slug,
      title,
      lessonId,
      document: { ...studio.document, id: slug, title },
    });

    setState((s) => ({ ...s, status: s.status ?? "draft", saved: true }));

    if (slug !== homeworkId) {
      await navigate({
        to: "/studio/homework/$homeworkId",
        params: { homeworkId: slug },
        replace: isNew,
      });
    }
  };

  if (state.phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn't load this homework. It hasn't been opened, so nothing here can
          overwrite it.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setState((s) => ({ ...s, phase: "loading" }));
              setReloadKey((k) => k + 1);
            }}
          >
            <RefreshCwIcon />
            Try again
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/studio">Back to the library</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudioCanvas
      studio={studio}
      label={studioKind("homework").singular}
      teacherContent={false}
      blockTypes={EXERCISE_BLOCK_ORDER}
      canSave={slug !== ""}
      onSave={save}
      meta={
        <HomeworkMetaEditor
          id={studio.lesson.meta.id}
          title={studio.lesson.meta.title}
          lessonId={lessonId}
          instructions={studio.lesson.meta.context}
          lessons={state.lessons}
          idLocked={state.saved}
          onChange={(patch) => {
            if (patch.lessonId !== undefined) setLessonId(patch.lessonId);
            if (patch.id !== undefined) studio.updateMeta({ id: patch.id });
            if (patch.title !== undefined) {
              studio.updateMeta({ title: patch.title });
            }
            if (patch.instructions !== undefined) {
              studio.updateMeta({ context: patch.instructions });
            }
          }}
        />
      }
      actions={
        <PublishToggle
          status={state.status}
          onChange={async (status) => {
            await setHomeworkStatus(slug, status);
            setState((s) => ({ ...s, status }));
          }}
        />
      }
    />
  );
}
