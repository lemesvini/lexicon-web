import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { StudentAvatarUpload } from "@/components/student-avatar";
import { setMyAvatar } from "@/lib/avatars";
import { fetchMyStudentAccess } from "@/lib/student-access";

export const Route = createFileRoute("/_authenticated/_student/profile")({
  component: ProfileRoute,
});

/** One fact about the account, as the student is allowed to see it. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="min-w-0 break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

/**
 * The student's own profile: their picture, and what the school has them down
 * as.
 *
 * The picture is the only thing they can change here. Their name, their email
 * and their module are the school's record of them, not a form — a student who
 * could rename themselves would be a student the roster can no longer find, and
 * their module is what the whole of `/learn` is scoped by.
 *
 * The access row comes from the route context, loaded once by `_student`, but
 * this page keeps its own copy: uploading a picture changes it, and the context
 * is only refetched on a navigation.
 */
function ProfileRoute() {
  const { access } = Route.useRouteContext();
  const [avatarPath, setAvatarPath] = React.useState(access.avatarPath);

  // A picture set in another tab, or by staff, since the route context loaded.
  React.useEffect(() => {
    let cancelled = false;
    fetchMyStudentAccess()
      .then((fresh) => {
        if (!cancelled && fresh) setAvatarPath(fresh.avatarPath);
      })
      .catch(() => {
        // Nothing to say: the page already has a usable copy from the route
        // context, and a failed refresh only means it might be a moment stale.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SiteNav align="narrow" />

      <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <StudentAvatarUpload
            studentId={access.id}
            name={access.fullName}
            path={avatarPath}
            size="lg"
            // `set_own_avatar` (0009) rather than a write to `students`: a
            // student may change this one column of their row and nothing else,
            // which no row-level policy can express.
            onSave={async (next) => {
              await setMyAvatar(next);
              setAvatarPath(next ?? "");
            }}
          />

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {access.fullName || "Your profile"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Press your picture to change it.
            </p>
          </div>
        </div>

        <section className="rounded-xl border bg-card px-5 py-2 text-card-foreground">
          <Field label="Name" value={access.fullName} />
          <Field label="Email" value={access.email} />
          <Field label="Module" value={access.moduleName ?? "Not placed yet"} />
        </section>

        <p className="px-5 pt-3 text-xs text-muted-foreground">
          Your name, email and module are set by the school. Ask your teacher if
          any of them is wrong.
        </p>
      </main>
    </div>
  );
}
