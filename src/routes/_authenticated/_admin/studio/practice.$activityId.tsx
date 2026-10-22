import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react";

import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";
import { requireAdmin } from "@/lib/route-guards";
import { useGoBack } from "@/hooks/use-go-back";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublishMenuItem } from "@/features/studio/components/publish-menu-item";
import { ListeningCardsEditor } from "@/features/studio/components/listening-cards-editor";
import { ReadingCardsEditor } from "@/features/studio/components/reading-cards-editor";
import { SpeakingCardsEditor } from "@/features/studio/components/speaking-cards-editor";
import { WritingCardsEditor } from "@/features/studio/components/writing-cards-editor";
import {
  PRACTICE_SKILLS,
  emptyContent,
  fetchPracticeActivity,
  listPracticeModules,
  savePracticeActivity,
  setPracticeStatus,
  type PracticeContent,
  type PracticeModule,
  type PracticeSkill,
} from "@/features/studio/data/practice";
import type { PublishStatus } from "@/features/studio/data/publishing";
import { NEW_DOCUMENT_ID as NEW, studioKind } from "@/features/studio/kinds";

export const Route = createFileRoute(
  "/_authenticated/_admin/studio/practice/$activityId",
)({ beforeLoad: requireAdmin, component: PracticeEditorRoute });

function PracticeEditorRoute() {
  const { activityId } = Route.useParams();
  return <PracticeEditor key={activityId} activityId={activityId} />;
}

const inputClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

// Level with the inputs beside it — the homework editor's trigger treatment.
const triggerClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm data-[size=default]:h-auto shadow-none dark:bg-background dark:hover:bg-background";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

type Meta = {
  id: string;
  title: string;
  moduleId: string;
  position: number;
};

/** What the student does with an activity's cards, under the editor. */
const SKILL_HINTS: Partial<Record<PracticeSkill, string>> = {
  speaking:
    "The student sees the Portuguese, says it in English, and the app listens.",
  listening:
    "The student hears the sentence and rebuilds it by tapping its words, in order.",
  writing:
    "The student reads the Portuguese and builds the English by tapping its words, in order.",
  reading:
    "The student reads the text, then answers its questions one at a time.",
};

type State = {
  /** "error" never renders the editor: a failed load shown as an empty deck
   *  invites a Save that would overwrite the real activity with nothing. */
  phase: "loading" | "ready" | "error";
  modules: PracticeModule[];
  lessons: CloudLessonSummary[];
  /** null while this activity has never been saved. */
  status: PublishStatus | null;
  /** True once saved: the id keys the row and can no longer be edited here. */
  saved: boolean;
};

/**
 * A practice activity: which module and skill it belongs to, and its content.
 *
 * Its own editor rather than the StudioCanvas: an activity isn't a deck of
 * slides made of blocks but, for speaking, a list of cards — the canvas's
 * slides, outline and JSON would all be about a shape it doesn't have.
 */
function PracticeEditor({ activityId }: { activityId: string }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const isNew = activityId === NEW;

  const [meta, setMeta] = React.useState<Meta>({
    id: isNew ? "" : activityId,
    title: "",
    moduleId: "",
    position: 0,
  });
  const [content, setContent] = React.useState<PracticeContent>(emptyContent("speaking"));
  const [state, setState] = React.useState<State>({
    phase: "loading",
    modules: [],
    lessons: [],
    status: null,
    saved: false,
  });
  const [reloadKey, setReloadKey] = React.useState(0);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      listPracticeModules(),
      listCloudLessons(),
      isNew ? Promise.resolve(null) : fetchPracticeActivity(activityId),
    ])
      .then(([modules, lessons, activity]) => {
        if (cancelled) return;

        if (activity) {
          setMeta({
            id: activity.id,
            title: activity.title,
            moduleId: activity.moduleId,
            position: activity.position,
          });
          setContent(activity.content);
        }

        setState({
          phase: "ready",
          modules,
          lessons,
          status: activity?.status ?? null,
          // An id that isn't in the table yet is still editable — typing a URL
          // for an activity that doesn't exist starts a new one under that slug.
          saved: activity !== null,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, phase: "error" }));
      });

    return () => {
      cancelled = true;
    };
  }, [activityId, isNew, reloadKey]);

  const slug = meta.id.trim();
  const moduleName = state.modules.find((m) => m.id === meta.moduleId)?.name ?? "";
  const canSave = slug !== "" && meta.moduleId !== "";

  // Takes the content to save rather than reading state, so the listening
  // editor can save the deck it has just added audio to in the same tick.
  const save = async (next: PracticeContent = content) => {
    if (slug === NEW) {
      throw new Error(
        `"${NEW}" is reserved for an activity that hasn't been saved yet — give this one another id.`,
      );
    }

    await savePracticeActivity({
      id: slug,
      title: meta.title.trim(),
      moduleId: meta.moduleId,
      position: meta.position,
      content: next,
    });

    setState((s) => ({ ...s, status: s.status ?? "draft", saved: true }));

    if (slug !== activityId) {
      await navigate({
        to: "/studio/practice/$activityId",
        params: { activityId: slug },
        replace: isNew,
      });
    }
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await save();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("idle");
      alert(`Could not save: ${(err as Error).message}`);
    }
  };

  if (state.phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn't load this activity. It hasn't been opened, so nothing here can
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
    <div className="min-h-svh bg-background text-foreground">
      {/* The StudioToolbar's look, without its slide-deck toggles. */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeftIcon />
          Back
        </Button>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl leading-none text-primary">Studio</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {studioKind("practice").singular}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More">
                <MoreHorizontalIcon />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <PublishMenuItem
                status={state.status}
                onChange={async (status) => {
                  await setPracticeStatus(slug, status);
                  setState((s) => ({ ...s, status }));
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleSave()}
            disabled={saveState === "saving" || !canSave}
            title={canSave ? "Save to cloud" : "Give it an id and a module to save it"}
          >
            {saveState === "saving" ? (
              <Loader2Icon className="animate-spin" />
            ) : saveState === "saved" ? (
              <CheckIcon />
            ) : (
              <CloudUploadIcon />
            )}
            <span className="sr-only">Save to cloud</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <input
            value={meta.title}
            onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
            placeholder="Practice 01"
            className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
          />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className={labelClass}>Activity id</span>
              <input
                value={meta.id}
                onChange={(e) => setMeta((m) => ({ ...m, id: e.target.value }))}
                disabled={state.saved}
                placeholder="book-one-speaking-01"
                className={`${inputClass} font-mono text-xs disabled:cursor-not-allowed disabled:text-muted-foreground`}
              />
              {state.saved && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Fixed once saved — it's what the row is keyed by.
                </span>
              )}
            </label>

            <label className="block">
              <span className={labelClass}>Module</span>
              <Select
                value={meta.moduleId || undefined}
                onValueChange={(moduleId) => setMeta((m) => ({ ...m, moduleId }))}
              >
                <SelectTrigger className={triggerClass}>
                  <SelectValue placeholder="Pick a module" />
                </SelectTrigger>
                <SelectContent>
                  {state.modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className={labelClass}>Skill</span>
              {/* Fixed once saved, and a fresh deck when changed before: a
                  card is a different thing in each skill. */}
              <Select
                value={content.skill}
                disabled={state.saved}
                onValueChange={(skill) => {
                  if (
                    content.cards.length > 0 &&
                    !window.confirm("Changing the skill discards the cards written so far.")
                  ) {
                    return;
                  }
                  setContent(emptyContent(skill as PracticeSkill));
                }}
              >
                <SelectTrigger className={triggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_SKILLS.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value} disabled={!skill.ready}>
                      {skill.label}
                      {!skill.ready && " — soon"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className={labelClass}>Position</span>
              <input
                type="number"
                min={0}
                value={meta.position}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, position: Number(e.target.value) || 0 }))
                }
                className={`${inputClass} tabular-nums`}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Its place among the module's {content.skill} activities.
              </span>
            </label>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Cards</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {content.cards.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {SKILL_HINTS[content.skill]} A card only reaches a student once their
            group has had the lesson it comes from.
          </p>
          {content.skill === "speaking" ? (
            <SpeakingCardsEditor
              cards={content.cards}
              lessons={state.lessons}
              module={moduleName}
              onChange={(cards) => setContent({ skill: "speaking", cards })}
            />
          ) : content.skill === "listening" ? (
            <ListeningCardsEditor
              deck={content}
              lessons={state.lessons}
              module={moduleName}
              activityId={slug}
              canGenerate={canSave && slug !== NEW}
              onChange={(deck) => setContent({ skill: "listening", ...deck })}
              onPersist={(deck) => save({ skill: "listening", ...deck })}
            />
          ) : content.skill === "writing" ? (
            <WritingCardsEditor
              cards={content.cards}
              lessons={state.lessons}
              module={moduleName}
              onChange={(cards) => setContent({ skill: "writing", cards })}
            />
          ) : content.skill === "reading" ? (
            <ReadingCardsEditor
              cards={content.cards}
              lessons={state.lessons}
              module={moduleName}
              onChange={(cards) => setContent({ skill: "reading", cards })}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
