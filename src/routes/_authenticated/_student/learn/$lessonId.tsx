import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentView } from "@/features/learn/components/document-view";
import {
  fetchStudentLesson,
  type StudentLesson,
} from "@/lib/student-content";

export const Route = createFileRoute("/_authenticated/_student/learn/$lessonId")(
  { component: LessonPage },
);

/** What one completed fetch produced, tagged with the request it answered. */
type Loaded = {
  token: string;
  status: "ready" | "missing" | "error";
  lesson: StudentLesson | null;
};

/**
 * One lesson as the student reads it. Homework used to hang off the bottom of
 * this page; it has its own section of the app now, reached from the menu.
 *
 * A lesson outside their module and a lesson whose material isn't published look
 * identical from here — both come back as null and render as "not available".
 * That is deliberate: a student has no business learning that a lesson exists
 * but is closed to them.
 */
function LessonPage() {
  const { lessonId } = Route.useParams();
  const { access } = Route.useRouteContext();

  // Same gate as the lessons list — a student who guesses a URL should meet the
  // onboarding, not the lesson.
  const locked = !access.onboardedAt;

  const [reloadKey, setReloadKey] = React.useState(0);
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);

  // Which request the screen is currently showing the answer to. Deriving
  // "loading" from a stale token — rather than resetting state in the effect —
  // is what keeps navigating to another lesson from rendering the previous one
  // for a frame.
  const token = `${lessonId}#${reloadKey}`;
  const status = loaded?.token === token ? loaded.status : "loading";
  const lesson = status === "ready" ? loaded?.lesson : null;

  React.useEffect(() => {
    let cancelled = false;
    if (locked) return;

    fetchStudentLesson(lessonId)
      .then((doc) => {
        if (cancelled) return;
        setLoaded({ token, status: doc ? "ready" : "missing", lesson: doc });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ token, status: "error", lesson: null });
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId, token, locked]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/learn" backLabel="Back to my module" align="narrow" />
      <main className="mx-auto w-full max-w-3xl lg:max-w-5xl space-y-8 px-4 pb-16 pt-4">
        {locked ? (
          <div className="space-y-3 rounded-md border p-6">
            <p className="text-sm text-muted-foreground">
              You need to finish the onboarding first.
            </p>
            <Button asChild size="sm">
              <Link to="/onboarding">Start onboarding</Link>
            </Button>
          </div>
        ) : status === "loading" ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : status === "missing" ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            This lesson isn’t available to you.
          </div>
        ) : status === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
            <p className="text-sm text-muted-foreground">
              Couldn’t load this lesson.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <RefreshCwIcon />
              Try again
            </Button>
          </div>
        ) : (
          lesson && (
            <article className="space-y-10">
              <header className="space-y-2">
                {lesson.unit && (
                  <p className="text-sm text-muted-foreground">{lesson.unit}</p>
                )}
                <h1 className="text-3xl font-semibold tracking-tight">
                  {lesson.title || lesson.id}
                </h1>
                {lesson.document.context && (
                  <p className="text-muted-foreground">
                    {lesson.document.context}
                  </p>
                )}
              </header>

              <DocumentView document={lesson.document} />
            </article>
          )
        )}
      </main>
    </div>
  );
}
