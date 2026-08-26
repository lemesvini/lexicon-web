import * as React from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { FacetedFilter } from "@/components/data-table-faceted-filter";
import { TableSkeleton } from "@/components/table-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateArtifactDialog } from "@/features/studio/components/create-artifact-dialog";
import { PickLessonDialog } from "@/features/studio/components/pick-lesson-dialog";
import {
  advancedColumns,
  homeworkColumns,
  lessonColumns,
  materialColumns,
} from "@/features/studio/components/library-columns";
import {
  AdvancedGallery,
  HomeworkGallery,
  LessonGallery,
  MaterialGallery,
} from "@/features/studio/components/library-gallery";
import {
  LibraryViewToggle,
  type LibraryView,
} from "@/features/studio/components/library-view-toggle";
import {
  listStudioLibrary,
  type StudioLibrary,
} from "@/features/studio/data/library";
import {
  ADVANCED_KIND,
  NEW_DOCUMENT_ID,
  STUDIO_KINDS,
  type StudioKind,
} from "@/features/studio/kinds";

type StudioSearch = { lessonId?: string };

/**
 * Where the chosen view is remembered — the same bargain the homepage's toggle
 * makes: how you like to read the library is not a per-visit question.
 */
const VIEW_KEY = "studio:library-view";

function readViewPreference(): LibraryView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "gallery"
      ? "gallery"
      : "table";
  } catch {
    // Private mode, blocked storage — not a reason to fail to draw the page.
    return "table";
  }
}

/** Editors that exist. The create dialog shows anything missing here as "Soon". */
const CREATABLE: readonly StudioKind[] = ["lesson", "material", "homework"];

export const Route = createFileRoute("/_authenticated/_admin/studio/")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    lessonId: typeof search.lessonId === "string" ? search.lessonId : undefined,
  }),
  // `/studio?lessonId=x` was how the editor was deep-linked before it had a
  // route of its own. Kept as a redirect so old links and bookmarks land in the
  // right place instead of on an unexplained library.
  beforeLoad: async ({ search }) => {
    await requireAdmin();
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
  advanced: [],
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

  // The search box and the module filter live here rather than in the table's
  // own toolbar, which is where they used to be: filters that reset every time
  // you changed how the list was drawn would make the toggle feel like it
  // navigated somewhere. Shared across the tabs for the same reason — the
  // module you are working in doesn't change when you go looking for its
  // homework.
  const [view, setView] = React.useState<LibraryView>(readViewPreference);
  const [query, setQuery] = React.useState("");
  const [selectedModules, setSelectedModules] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // See readViewPreference — the toggle still works for this session.
    }
  }, [view]);

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

  /**
   * The toolbar's filters, applied here rather than by the table so the gallery
   * obeys them too. Every kind is searched by the words on its card — its own
   * title, plus the group's name for a copy, which is what that tab is found by.
   */
  const filter = React.useCallback(
    <T extends { module: string }>(rows: T[], text: (row: T) => string) => {
      const needle = query.trim().toLowerCase();
      const chosen = new Set(selectedModules);
      return rows.filter(
        (row) =>
          (!needle || text(row).toLowerCase().includes(needle)) &&
          (chosen.size === 0 || chosen.has(row.module)),
      );
    },
    [query, selectedModules],
  );

  const lessons = filter(library.lessons, (row) => row.title);
  const materials = filter(library.materials, (row) => row.title);
  const homework = filter(library.homework, (row) => row.title);
  const advanced = filter(
    library.advanced,
    (row) => `${row.groupName} ${row.title}`,
  );

  // The counts on the tabs are of what the tab holds, not of what survives the
  // search: they are how you find the tab worth looking in, and a row of zeroes
  // while typing would say the library is empty rather than that this tab has
  // no match.
  const counts: Record<StudioKind, number> = {
    lesson: library.lessons.length,
    material: library.materials.length,
    homework: library.homework.length,
    advanced: library.advanced.length,
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
              {/* Outside the map: a group's copy isn't something you create from
                  here, so it isn't in STUDIO_KINDS and isn't in the Create
                  dialog. It is still something you go looking for. */}
              <TabsTrigger value={ADVANCED_KIND.kind} className="px-3">
                {ADVANCED_KIND.label}
                <span className="tabular-nums text-muted-foreground">
                  {counts.advanced}
                </span>
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Filter the library..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="max-w-sm"
              />
              <LibraryViewToggle value={view} onValueChange={setView} />

              <div className="ml-auto flex items-center gap-2">
                <FacetedFilter
                  label="Module"
                  options={library.modules}
                  clearLabel="All modules"
                  value={selectedModules}
                  onValueChange={setSelectedModules}
                />
              </div>
            </div>

            <TabsContent value="lesson">
              {view === "gallery" ? (
                <LessonGallery rows={lessons} />
              ) : (
                <DataTable
                  columns={lessonColumns()}
                  data={lessons}
                  emptyMessage="Nothing here yet — Create makes the first one."
                  countLabel={(n) => `${n} presentation${n === 1 ? "" : "s"}`}
                />
              )}
            </TabsContent>

            <TabsContent value="material">
              {view === "gallery" ? (
                <MaterialGallery rows={materials} onChanged={refresh} />
              ) : (
                <DataTable
                  columns={materialColumns({ onChanged: refresh })}
                  data={materials}
                  emptyMessage="No student material yet."
                  countLabel={(n) => `${n} material${n === 1 ? "" : "s"}`}
                />
              )}
            </TabsContent>

            <TabsContent value="advanced">
              {view === "gallery" ? (
                <AdvancedGallery rows={advanced} />
              ) : (
                <DataTable
                  columns={advancedColumns()}
                  data={advanced}
                  emptyMessage="No group has its own copy of a lesson yet. Assign a module in a group's studio."
                  countLabel={(n) => `${n} cop${n === 1 ? "y" : "ies"}`}
                />
              )}
            </TabsContent>

            <TabsContent value="homework">
              {view === "gallery" ? (
                <HomeworkGallery rows={homework} onChanged={refresh} />
              ) : (
                <DataTable
                  columns={homeworkColumns({ onChanged: refresh })}
                  data={homework}
                  emptyMessage="No homework yet."
                  countLabel={(n) => `${n} homework`}
                />
              )}
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
