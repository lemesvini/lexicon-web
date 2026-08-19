import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import PresenterMenu from "@/features/homepage/components/presenter-menu";
import { UpcomingClasses } from "@/features/homepage/components/upcoming-classes";

export const Route = createFileRoute("/_authenticated/_admin/lessons")({
  component: LessonsPage,
});

function LessonsPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
        {/* Above the library, and rendering nothing when nothing is on — so on a
            day off the page is exactly what it was before. */}
        <UpcomingClasses />
        <PresenterMenu />
      </main>
    </div>
  );
}
