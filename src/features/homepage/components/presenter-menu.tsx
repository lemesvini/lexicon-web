import * as React from "react";
import { FolderOpenIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { FacetedFilter } from "@/components/data-table-faceted-filter";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  cloudClassRow,
  localClassRow,
  type ClassRow,
} from "@/features/homepage/data/classes";
import { classesColumns } from "@/features/homepage/components/classes-columns";
import { ClassesGallery } from "@/features/homepage/components/classes-gallery";
import {
  ClassViewToggle,
  type ClassView,
} from "@/features/homepage/components/class-view-toggle";
import { listCloudLessons, listCloudModules } from "@/lib/lessons-cloud";
import { putLocalLesson } from "@/lib/lesson-store";
import { parseLesson } from "@/features/studio/model";

/**
 * Where the chosen view is remembered. The gallery is the default in the sense
 * that matters — what a teacher sees before they have said otherwise — but a
 * preference about how to read the library is not a per-visit question, so
 * having said otherwise sticks. Same reasoning as the studio's preview toggle.
 */
const VIEW_KEY = "homepage:classes-view";

function readViewPreference(): ClassView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "table"
      ? "table"
      : "gallery";
  } catch {
    // Private mode, blocked storage — a preference is not a reason to fail to
    // draw the page.
    return "gallery";
  }
}

/**
 * The homepage's class library: every launchable class — from the shared cloud
 * library or opened from a local JSON file — with Present (`/present`) and
 * Control (`/control`) on each one.
 *
 * Two views over the same rows: a gallery of covers (the default — a teacher
 * recognises the class they are about to teach by its cover long before they
 * read its title) and the table, for when the question is "which of these
 * hundred" rather than "that one".
 *
 * The search box and the module filter live here rather than in the table's own
 * toolbar, which is what they used to be: filters that reset every time you
 * changed how the list was drawn would make the toggle feel like it navigated
 * somewhere.
 */
export default function PresenterMenu() {
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [cloud, setCloud] = React.useState<ClassRow[]>([]);
  const [local, setLocal] = React.useState<ClassRow[]>([]);
  const [modules, setModules] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  const [view, setView] = React.useState<ClassView>(readViewPreference);
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
    // The module list is its own query rather than being derived from the rows:
    // it is the full set of modules in the library, independent of what the
    // table currently holds.
    Promise.all([listCloudLessons(), listCloudModules()])
      .then(([lessons, moduleNames]) => {
        if (cancelled) return;
        setCloud(lessons.map(cloudClassRow));
        setModules(moduleNames);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  // A local file shadows a cloud lesson of the same id, matching the order
  // present/control resolve them in (@/features/presenter/use-resolved-lesson).
  //
  // Ahead of the library rather than sorted into it: `listCloudLessons` returns
  // the curriculum's own sequence, and a file opened from disk has no place in
  // it — but it was opened a second ago, so it is the one being looked for.
  const items = React.useMemo(() => {
    const localIds = new Set(local.map((row) => row.id));
    return [...local, ...cloud.filter((row) => !localIds.has(row.id))];
  }, [local, cloud]);

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chosen = new Set(selectedModules);
    return items.filter(
      (row) =>
        (!needle || row.title.toLowerCase().includes(needle)) &&
        (chosen.size === 0 || chosen.has(row.module)),
    );
  }, [items, query, selectedModules]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const lesson = parseLesson(await file.text());
      const id = putLocalLesson(lesson);
      const row = localClassRow(id, lesson, file.name.replace(/\.json$/i, ""));
      setLocal((prev) => [row, ...prev.filter((i) => i.id !== id)]);
    } catch (err) {
      alert(`Could not open file: ${(err as Error).message}`);
    }
  };

  return (
    <div className="w-full space-y-6">
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
          <p className="text-sm text-muted-foreground">
            Couldn’t load the class library.
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter classes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-sm"
            />
            <ClassViewToggle value={view} onValueChange={setView} />

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                title="Open a local file"
              >
                <FolderOpenIcon className="text-muted-foreground" />
              </Button>
              <FacetedFilter
                label="Module"
                options={modules}
                clearLabel="All modules"
                value={selectedModules}
                onValueChange={setSelectedModules}
              />
            </div>
          </div>

          {view === "gallery" ? (
            <ClassesGallery
              rows={rows}
              showEveryUnit={query.trim() !== ""}
              emptyMessage="No classes match."
            />
          ) : (
            <DataTable
              columns={classesColumns}
              data={rows}
              emptyMessage="No classes match."
              countLabel={(count) => `${count} class${count === 1 ? "" : "es"}`}
            />
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
