import * as React from "react";
import { FolderOpenIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/data-table";
import {
  cloudClassRow,
  localClassRow,
  type ClassRow,
} from "@/features/homepage/data/classes";
import { classesColumns } from "@/features/homepage/components/classes-columns";
import { listCloudLessons, listCloudModules } from "@/lib/lessons-cloud";
import { putLocalLesson } from "@/lib/lesson-store";
import { parseLesson } from "@/features/studio/model";

/** Placeholder that holds the table's shape while the library loads. */
function TableSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-full max-w-sm" />
        <Skeleton className="ml-auto h-6 w-24" />
      </div>
      <div className="space-y-px overflow-hidden rounded-md border p-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * The homepage's class library: every launchable class — from the shared cloud
 * library or opened from a local JSON file — in a searchable, sortable table,
 * with Present (`/present`) and Control (`/control`) on each row.
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
  const items = React.useMemo(() => {
    const localIds = new Set(local.map((row) => row.id));
    return [...local, ...cloud.filter((row) => !localIds.has(row.id))];
  }, [local, cloud]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground">
            Put a class on the display, or drive it from this device.
          </p>
        </div> */}
      </div>

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
        <DataTable
          columns={classesColumns}
          data={items}
          filterColumn="title"
          filterPlaceholder="Filter classes..."
          toolbarActions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <FolderOpenIcon className="text-muted-foreground" />
              {/* Open a local file */}
            </Button>
          }
          facets={[
            {
              columnId: "module",
              label: "Module",
              options: modules,
              clearLabel: "All modules",
            },
          ]}
          emptyMessage="No classes match."
          countLabel={(count) => `${count} class${count === 1 ? "" : "es"}`}
        />
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
