import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CopyPlusIcon } from "lucide-react";

import type { Lesson } from "@/lib/lessons";
import { requireAdmin } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioLesson } from "@/features/studio/use-studio-lesson";
import { StudioCanvas } from "@/features/studio/components/studio-canvas";
import { MaterialMetaEditor } from "@/features/studio/components/material-meta-editor";
import { PublishToggle } from "@/features/studio/components/publish-toggle";
import {
  fetchMaterial,
  saveMaterial,
  setMaterialStatus,
} from "@/features/studio/data/materials";
import type { PublishStatus } from "@/features/studio/data/publishing";
import { openLessonForEditing } from "@/features/studio/data/open-lesson";
import { stripTeacherContent } from "@/features/studio/strip-teacher";
import { studioKind } from "@/features/studio/kinds";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/material/$lessonId",
)({ beforeLoad: requireAdmin, component: MaterialEditorRoute });

function MaterialEditorRoute() {
  const { lessonId } = Route.useParams();
  return <MaterialEditor key={lessonId} lessonId={lessonId} />;
}

/** A material that doesn't exist yet: the lesson's identity, and nothing else.
 *  Empty rather than pre-filled — "copy from the presentation" is one click
 *  away, and starting from a copy should be a decision, not a default. */
function blankMaterial(lesson: Lesson, lessonId: string): Lesson {
  return {
    id: lessonId,
    unit: lesson.unit ?? "",
    module: lesson.module ?? "",
    title: lesson.title ?? "",
    context: "",
    minorCanDo: "",
    grammarFocus: [],
    classPlan: [],
    slides: [],
  };
}

type State = {
  phase: "loading" | "ready" | "missing";
  lesson: Lesson | null;
  /** null while no material row exists yet. */
  status: PublishStatus | null;
};

function MaterialEditor({ lessonId }: { lessonId: string }) {
  const studio = useStudioLesson();
  const { load } = studio;

  const [state, setState] = React.useState<State>({
    phase: "loading",
    lesson: null,
    status: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([openLessonForEditing(lessonId), fetchMaterial(lessonId)])
      .then(([lesson, material]) => {
        if (cancelled) return;

        // No lesson means no material: the row is keyed by the lesson and the
        // foreign key would refuse it anyway.
        if (!lesson) {
          setState({ phase: "missing", lesson: null, status: null });
          return;
        }

        load(material ? material.document : blankMaterial(lesson, lessonId));
        setState({
          phase: "ready",
          lesson,
          status: material?.status ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ phase: "missing", lesson: null, status: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId, load]);

  const save = async () => {
    // The document is stored under the lesson's id; keeping the copy inside the
    // JSON in step means an exported material still says what it belongs to.
    await saveMaterial(lessonId, { ...studio.document, id: lessonId });
    setState((s) => ({ ...s, status: s.status ?? "draft" }));
  };

  const copyFromPresentation = () => {
    if (!state.lesson) return;

    // A plain window.confirm is fine here — this is a button, not a Radix menu
    // item, so there is no menu-close race to lose (see module-row-actions).
    const hasWork = studio.lesson.slides.some((s) => s.blocks.length > 0);
    if (
      hasWork &&
      !window.confirm(
        "Replace what's here with a copy of the presentation? This can't be undone.",
      )
    ) {
      return;
    }

    load({ ...stripTeacherContent(state.lesson), id: lessonId });
  };

  if (state.phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.phase === "missing" || !state.lesson) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          There's no lesson called “{lessonId}”, so there's nothing to write
          material for.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/studio">Back to the library</Link>
        </Button>
      </div>
    );
  }

  return (
    <StudioCanvas
      studio={studio}
      label={studioKind("material").singular}
      teacherContent={false}
      onSave={save}
      meta={
        <MaterialMetaEditor
          lesson={{
            id: lessonId,
            title: state.lesson.title ?? "",
            unit: state.lesson.unit ?? "",
            module: state.lesson.module ?? "",
          }}
          intro={studio.lesson.meta.context}
          onIntroChange={(context) => studio.updateMeta({ context })}
        />
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={copyFromPresentation}>
            <CopyPlusIcon />
            Copy from presentation
          </Button>
          <PublishToggle
            status={state.status}
            onChange={async (status) => {
              await setMaterialStatus(lessonId, status);
              setState((s) => ({ ...s, status }));
            }}
          />
        </>
      }
    />
  );
}
