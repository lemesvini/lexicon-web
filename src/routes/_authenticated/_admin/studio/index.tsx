import * as React from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateArtifactDialog } from "@/features/studio/components/create-artifact-dialog";
import { PickLessonDialog } from "@/features/studio/components/pick-lesson-dialog";
import {
  homeworkColumns,
  lessonColumns,
  materialColumns,
} from "@/features/studio/components/library-columns";
import {
  listStudioLibrary,
  type StudioLibrary,
} from "@/features/studio/data/library";
import {
  NEW_DOCUMENT_ID,
  STUDIO_KINDS,
  type StudioKind,
} from "@/features/studio/kinds";

type StudioSearch = { lessonId?: string };

/** Editors that exist. The create dialog shows anything missing here as "Soon". */
const CREATABLE: readonly StudioKind[] = ["lesson", "material", "homework"];

export const Route = createFileRoute("/_authenticated/_admin/studio/")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    lessonId: typeof search.lessonId === "string" ? search.lessonId : undefined,
  }),
  // `/studio?lessonId=x` was how the editor was deep-linked before it had a
  // route of its own. Kept as a redirect so old links and bookmarks land in the
  // right place instead of on an unexplained library.
  beforeLoad: ({ search }) => {
    if (search.lessonId) {
      throw redirect({
        to: "/studio/lesson/$lessonId",
        params: { lessonId: search.lessonId },
      });
    }
  },
  component: StudioLibraryPage,
});

const EMPTY: StudioLibrary = {
  lessons: [],
  materials: [],
  homework: [],
  modules: [],
};

/**
 * The Studio's library: everything authored, in three tabs, with one button that
 * asks what to make next.
 */
function StudioLibraryPage() {
  const navigate = useNavigate();

  const [library, setLibrary] = React.useState<StudioLibrary>(EMPTY);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pickLessonOpen, setPickLessonOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listStudioLibrary()
      .then((next) => {
        if (cancelled) return;
        setLibrary(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const handleCreate = (kind: StudioKind) => {
    if (kind === "lesson") {
      void navigate({
        to: "/studio/lesson/$lessonId",
        params: { lessonId: NEW_DOCUMENT_ID },
      });
    } else if (kind === "homework") {
      void navigate({
        to: "/studio/homework/$homeworkId",
        params: { homeworkId: NEW_DOCUMENT_ID },
      });
    } else {
      // A material has no id of its own — it belongs to a lesson, so choosing
      // that lesson is the act of creating it.
      setPickLessonOpen(true);
    }
  };

  const moduleFacet = [
    {
      columnId: "module",
      label: "Module",
      options: library.modules,
      clearLabel: "All modules",
    },
  ];

  const counts: Record<StudioKind, number> = {
    lesson: library.lessons.length,
    material: library.materials.length,
    homework: library.homework.length,
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-4xl leading-none text-primary">
              Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Everything you've authored — what you project, what your students
              read, and what they take home.
            </p>
          </div>

          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            Create
          </Button>
        </div>

        {status === "loading" ? (
          <TableSkeleton />
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load the library.
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCwIcon />
              Try again
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="lesson" className="gap-4">
            <TabsList>
              {STUDIO_KINDS.map(({ kind, label }) => (
                <TabsTrigger key={kind} value={kind} className="px-3">
                  {label}
                  <span className="tabular-nums text-muted-foreground">
                    {counts[kind]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="lesson">
              <DataTable
                columns={lessonColumns()}
                data={library.lessons}
                filterColumn="title"
                filterPlaceholder="Filter presentations..."
                facets={moduleFacet}
                emptyMessage="Nothing here yet — Create makes the first one."
                countLabel={(n) => `${n} presentation${n === 1 ? "" : "s"}`}
              />
            </TabsContent>

            <TabsContent value="material">
              <DataTable
                columns={materialColumns({ onChanged: refresh })}
                data={library.materials}
                filterColumn="title"
                filterPlaceholder="Filter materials..."
                facets={moduleFacet}
                emptyMessage="No student material yet."
                countLabel={(n) => `${n} material${n === 1 ? "" : "s"}`}
              />
            </TabsContent>

            <TabsContent value="homework">
              <DataTable
                columns={homeworkColumns({ onChanged: refresh })}
                data={library.homework}
                filterColumn="title"
                filterPlaceholder="Filter homework..."
                facets={moduleFacet}
                emptyMessage="No homework yet."
                countLabel={(n) => `${n} homework`}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <CreateArtifactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSelect={handleCreate}
        enabled={CREATABLE}
      />

      <PickLessonDialog
        open={pickLessonOpen}
        onOpenChange={setPickLessonOpen}
        lessons={library.lessons}
        onPick={(lessonId) =>
          void navigate({
            to: "/studio/material/$lessonId",
            params: { lessonId },
          })
        }
      />
    </div>
  );
}
