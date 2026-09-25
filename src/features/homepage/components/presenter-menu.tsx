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
import { ModulesGallery } from "@/features/homepage/components/modules-gallery";
import {
  ClassViewToggle,
  type ClassView,
} from "@/features/homepage/components/class-view-toggle";
import { listCloudLessons } from "@/lib/lessons-cloud";
import {
  listDashboardHiddenModules,
  listModuleNames,
} from "@/features/modules/data/modules";
import { putLocalLesson } from "@/lib/lesson-store";
import { parseLesson } from "@/features/studio/model";

const VIEW_KEY = "homepage:classes-view";

function readViewPreference(): ClassView {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    return stored === "table" || stored === "gallery" ? stored : "module";
  } catch {
    // Private mode, blocked storage — a preference is not a reason to fail to
    // draw the page.
    return "module";
  }
}

export default function PresenterMenu() {
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [cloud, setCloud] = React.useState<ClassRow[]>([]);
  const [local, setLocal] = React.useState<ClassRow[]>([]);
  const [modules, setModules] = React.useState<string[]>([]);
  const [hiddenModules, setHiddenModules] = React.useState<string[]>([]);
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
    }
  }, [view]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCloudLessons(),
      listModuleNames(),
      listDashboardHiddenModules(),
    ])
      .then(([lessons, moduleNames, hidden]) => {
        if (cancelled) return;
        setCloud(lessons.map(cloudClassRow));
        setModules(moduleNames);
        setHiddenModules(hidden);
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
  const items = React.useMemo(() => {
    const localIds = new Set(local.map((row) => row.id));
    return [...local, ...cloud.filter((row) => !localIds.has(row.id))];
  }, [local, cloud]);

  const moduleOptions = React.useMemo(() => {
    const known = new Set(modules);
    const extra = new Set<string>();
    for (const row of items) {
      const name = row.module.trim();
      if (name && !known.has(name)) extra.add(name);
    }
    return [...modules, ...[...extra].sort((a, b) => a.localeCompare(b))];
  }, [modules, items]);

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
                options={moduleOptions}
                clearLabel="All modules"
                searchPlaceholder="Search modules..."
                value={selectedModules}
                onValueChange={setSelectedModules}
              />
            </div>
          </div>

          {view === "module" ? (
            <ModulesGallery
              rows={rows}
              revealedModules={selectedModules}
              hiddenModules={hiddenModules}
              emptyMessage="No classes match."
            />
          ) : view === "gallery" ? (
            <ClassesGallery
              rows={rows}
              showEveryModule={query.trim() !== ""}
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
