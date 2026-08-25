import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { saveLessonToCloud } from "@/lib/lessons-cloud";
import { requireAdmin } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioLesson } from "@/features/studio/use-studio-lesson";
import { StudioCanvas } from "@/features/studio/components/studio-canvas";
import { LessonMetaEditor } from "@/features/studio/components/lesson-meta-editor";
import { LessonSourceMenuItems } from "@/features/studio/components/lesson-source-menu";
import { openLessonForEditing } from "@/features/studio/data/open-lesson";
import { NEW_DOCUMENT_ID as NEW, studioKind } from "@/features/studio/kinds";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/lesson/$lessonId",
)({ beforeLoad: requireAdmin, component: LessonEditorRoute });

function LessonEditorRoute() {
  const { lessonId } = Route.useParams();

  // Keyed, so changing which lesson is open remounts the editor rather than
  // trying to reconcile one document's editing state onto another's. The editor
  // IS its document; there is nothing meaningful to carry across.
  return <LessonEditor key={lessonId} lessonId={lessonId} />;
}

function LessonEditor({ lessonId }: { lessonId: string }) {
  const navigate = useNavigate();
  const studio = useStudioLesson();
  const { load } = studio;

  const isNew = lessonId === NEW;

  // "missing" still renders the editor — a blank canvas with a note, not an
  // error page. Typing a URL for a lesson that doesn't exist yet is a reasonable
  // way to start one.
  //
  // "error" is emphatically NOT that, which is why the two are separate: a
  // failed request rendered as a blank editor invites a Save that would
  // overwrite a perfectly good lesson with nothing.
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >(isNew ? "ready" : "loading");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (isNew) return;

    let cancelled = false;

    openLessonForEditing(lessonId)
      .then((doc) => {
        if (cancelled) return;
        if (doc) load(doc);
        setStatus(doc ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId, isNew, load, reloadKey]);

  const id = studio.document.id.trim();

  const save = async () => {
    if (id === NEW) {
      throw new Error(
        `"${NEW}" is reserved for a lesson that hasn't been saved yet — give this one another id.`,
      );
    }

    await saveLessonToCloud(studio.document);

    // Saving under a new id moves the editor to that lesson's URL. The remount
    // re-reads it from the cloud, which costs one request and confirms the save
    // landed — cheap enough not to be worth outsmarting.
    if (id !== lessonId) {
      await navigate({
        to: "/studio/lesson/$lessonId",
        params: { lessonId: id },
        replace: isNew,
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn't load “{lessonId}”. It hasn't been opened, so nothing here can
          overwrite it.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus("loading");
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
    <>
      {status === "missing" && (
        <p className="border-b bg-muted/40 px-4 py-2 text-center text-sm text-muted-foreground">
          No lesson called “{lessonId}” — this is a blank editor, and saving will
          create it.
        </p>
      )}

      <StudioCanvas
        studio={studio}
        label={studioKind("lesson").singular}
        canSave={id !== ""}
        onSave={save}
        meta={
          <LessonMetaEditor
            meta={studio.lesson.meta}
            onChange={studio.updateMeta}
          />
        }
        menuItems={<LessonSourceMenuItems onLoad={load} />}
      />
    </>
  );
}
