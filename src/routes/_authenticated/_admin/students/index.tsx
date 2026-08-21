import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { StudentsRoster } from "@/features/students/components/students-roster";

export const Route = createFileRoute("/_authenticated/_admin/students/")({
  component: StudentsPage,
});

function StudentsPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav backTo="/lessons" backLabel="Back to lessons" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        </div>

        <StudentsRoster />
      </main>
    </div>
  );
}
