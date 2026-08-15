import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import PresenterMenu from "@/features/homepage/components/presenter-menu";

export const Route = createFileRoute("/_authenticated/_admin/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <PresenterMenu />
      </main>
    </div>
  );
}
