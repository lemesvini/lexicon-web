import * as React from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";

import type { Lesson } from "@/lib/lessons";
import { EXERCISE_BLOCK_ORDER } from "@/features/blocks";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchGroupHomework,
  fetchGroupMaterial,
  saveGroupHomework,
  saveGroupMaterial,
  setGroupHomeworkStatus,
  setGroupMaterialStatus,
} from "@/features/groups/data/group-content";
import { fetchGroupLesson } from "@/features/groups/data/group-lessons";
import { fetchGroup, type GroupRow } from "@/features/groups/data/groups";
import { fetchHomework } from "@/features/studio/data/homework";
import { fetchMaterial } from "@/features/studio/data/materials";
import type { PublishStatus } from "@/features/studio/data/publishing";
import { advancedCount, isBase, rebaseOnto } from "../advanced-context";
import { importAdvancedFrom } from "../import-advanced";
import { insertSuggestion } from "../insert-suggestion";
import { useAdvancedStudio } from "../use-advanced-studio";
import { AdvancedContextDrawer } from "./advanced-context-drawer";
import { PublishMenuItem } from "./publish-menu-item";
import { StudioCanvas } from "./studio-canvas";

/** Which of the two student-facing copies is being edited. */
export type GroupCopyKind = "material" | "homework";

type Loaded = {
  /** The copy's row id — what the status write is keyed by. */
  rowId: string;
  document: Lesson;
  status: PublishStatus;
  baseSyncedAt: string | null;
  /** The shared document as it stands now: what a rebase rebuilds from. */
  base: Lesson | null;
  /** The shared row's last save, for spotting drift. */
  baseUpdatedAt: string | null;
  /** Shown in the header — the lesson or homework this belongs to. */
  title: string;
  subtitle: string;
};

async function loadCopy(
  kind: GroupCopyKind,
  groupId: string,
  documentId: string,
): Promise<Loaded | null> {
  if (kind === "material") {
    const [copy, base] = await Promise.all([
      fetchGroupMaterial(groupId, documentId),
      fetchMaterial(documentId),
    ]);
    if (!copy) return null;
    return {
      rowId: copy.id,
      document: copy.document,
      status: copy.status,
      baseSyncedAt: copy.baseSyncedAt,
      base: base?.document ?? null,
      baseUpdatedAt: base?.updatedAt || null,
      title: copy.document.title || documentId,
      subtitle: [copy.document.unit, copy.document.module]
        .filter(Boolean)
        .join(" · "),
    };
  }

  const [copy, base] = await Promise.all([
    fetchGroupHomework(groupId, documentId),
    fetchHomework(documentId),
  ]);
  if (!copy) return null;
  return {
    rowId: copy.id,
    document: copy.document,
    status: copy.status,
    baseSyncedAt: copy.baseSyncedAt,
    base: base?.document ?? null,
    baseUpdatedAt: base?.updatedAt || null,
    title: base?.title || copy.document.title || documentId,
    subtitle: base?.lessonId ? `Homework for ${base.lessonId}` : "Unfiled homework",
  };
}

/**
 * One group's copy of what its students read.
 *
 * The same editor as the group's copy of a presentation, and deliberately so:
 * the base half is locked, everything added is stamped `advancedContext: true`,
 * and Refresh from base rebuilds on the shared document without dropping the
 * additions. What is different is who reads the result — so this one hides
 * teacher content, and publishes.
 *
 * Publishing is what makes the copy real. Until it is published the group's
 * students go on reading the shared material; from the moment it is, they read
 * this and nobody else does (see `student_lessons` in migration 0013).
 */
export function GroupCopyEditor({
  kind,
  groupId,
  documentId,
}: {
  kind: GroupCopyKind;
  groupId: string;
  /** The lesson id for a material, the homework slug for a homework. */
  documentId: string;
}) {
  const studio = useAdvancedStudio();
  const { load } = studio;
  const router = useRouter();
  const navigate = useNavigate();

  const [group, setGroup] = React.useState<GroupRow | null>(null);
  /**
   * This group's copy of the presentation for the same lesson, when they have
   * one — the source for "Import from the presentation".
   *
   * Materials only: a homework is keyed by its own slug, and the presentation it
   * would pull from is the lesson's, not this document's.
   */
  const [presentation, setPresentation] = React.useState<Lesson | null>(null);
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [status, setStatus] = React.useState<PublishStatus>("draft");
  const [baseSyncedAt, setBaseSyncedAt] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"loading" | "ready" | "missing">(
    "loading",
  );

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchGroup(groupId),
      loadCopy(kind, groupId, documentId),
      // Missing is the normal case — plenty of groups have a material and no
      // presentation copy — so its absence hides the menu item rather than
      // failing the load.
      kind === "material"
        ? fetchGroupLesson(groupId, documentId).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([groupRow, copy, lessonCopy]) => {
        if (cancelled) return;
        if (!groupRow || !copy) {
          setPhase("missing");
          return;
        }
        load(copy.document);
        setPresentation(lessonCopy?.document ?? null);
        setGroup(groupRow);
        setLoaded(copy);
        setStatus(copy.status);
        setBaseSyncedAt(copy.baseSyncedAt);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [kind, groupId, documentId, load]);

  /** Back to wherever this was opened from — the group's studio on a pasted
   *  link or a refresh, where history has nothing to go back to. */
  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void navigate({ to: "/studio/group/$groupId", params: { groupId } });
  };

  const save = async () => {
    // `baseSyncedAt` goes back untouched, and `status` is not in the payload at
    // all: saving your additions is neither taking on the shared document's
    // changes nor handing the copy out.
    if (kind === "material") {
      await saveGroupMaterial(groupId, documentId, studio.document, baseSyncedAt);
    } else {
      await saveGroupHomework(groupId, documentId, studio.document, baseSyncedAt);
    }
  };

  const baseIsNewer =
    !!baseSyncedAt && !!loaded?.baseUpdatedAt && loaded.baseUpdatedAt > baseSyncedAt;

  const refreshFromBase = () => {
    if (!loaded?.base) return;
    if (
      !window.confirm(
        "Rebuild this copy on the current shared version? Your added blocks are kept; any that no longer have a slide to sit on are collected onto one at the end.",
      )
    ) {
      return;
    }
    load(rebaseOnto(loaded.base, studio.document));
    setBaseSyncedAt(loaded.baseUpdatedAt);
  };

  /** How much the presentation has that this copy could take — 0 hides the
   *  menu item, which is the difference between "nothing to import" and an
   *  item that reports having done nothing. */
  const presentationCount = presentation ? advancedCount(presentation) : 0;

  const importFromPresentation = () => {
    if (!presentation) return;
    const { document, added, skipped } = importAdvancedFrom(
      presentation,
      studio.document,
    );
    if (added === 0) {
      alert(
        skipped > 0
          ? "Everything this group added to the presentation is already here."
          : "This group hasn't added anything to the presentation yet.",
      );
      return;
    }
    load(document);
    alert(
      `Brought ${added} addition${added === 1 ? "" : "s"} across from the presentation${
        skipped > 0 ? `, and left ${skipped} that were already here` : ""
      }. They're at the end — save when you're happy with them.`,
    );
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phase === "missing" || !group || !loaded) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          This group has no copy of “{documentId}”. Copies are made in the
          group’s studio — make one there and it’ll open here.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/studio/group/$groupId" params={{ groupId }}>
            Back to the group’s studio
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <StudioCanvas
      studio={studio}
      label={kind === "material" ? "Student material" : "Homework"}
      teacherContent={false}
      blockTypes={kind === "homework" ? EXERCISE_BLOCK_ORDER : undefined}
      railLayout="stacked"
      portable={false}
      back={{ label: "Back", onClick: goBack }}
      slideLocked={(slide) => isBase(slide.meta)}
      drawerLabel="LexStudio Agent"
      drawer={
        // The same agent as the presentation's, told which document it is
        // adding to: it reads this class — their notes, their reports, the
        // homework they have handed in — and what it may propose follows from
        // the kind. Exercises for a homework, sections for a material.
        <AdvancedContextDrawer
          kind={kind}
          groupId={groupId}
          documentId={documentId}
          groupName={group.name}
          slides={studio.lesson.slides}
          onInsert={(suggestion) => insertSuggestion(studio, suggestion)}
        />
      }
      onSave={save}
      meta={
        <CopyHeader
          groupName={group.name}
          kind={kind}
          title={loaded.title}
          subtitle={loaded.subtitle}
          status={status}
        />
      }
      menuItems={
        <>
          {kind === "material" && presentationCount > 0 && (
            <DropdownMenuItem onSelect={importFromPresentation}>
              Import from the presentation
            </DropdownMenuItem>
          )}
          {baseIsNewer && (
            <DropdownMenuItem onSelect={refreshFromBase}>
              Refresh from base
            </DropdownMenuItem>
          )}
          <PublishMenuItem
            status={status}
            onChange={async (next) => {
              if (kind === "material") {
                await setGroupMaterialStatus(loaded.rowId, next);
              } else {
                await setGroupHomeworkStatus(loaded.rowId, next);
              }
              setStatus(next);
            }}
          />
        </>
      }
    />
  );
}

/** What this copy is, who it is for, and whether they can see it yet. Nothing
 *  editable: the title and unit belong to the shared document, and a class
 *  renaming its copy would only make one lesson answer to two names. */
function CopyHeader({
  groupName,
  kind,
  title,
  subtitle,
  status,
}: {
  groupName: string;
  kind: GroupCopyKind;
  title: string;
  subtitle: string;
  status: PublishStatus;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {kind === "material" ? "Student material" : "Homework"} · {groupName}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {title || "Untitled"}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        The sections below are the shared version — you can add to them, but not
        change or remove them. Anything you add is only ever seen by {groupName},
        and{" "}
        {status === "published"
          ? "this copy is published: they are reading it instead of the shared one."
          : "while this copy is a draft they go on reading the shared one — publish it from the menu when it’s ready."}
      </p>
    </section>
  );
}
