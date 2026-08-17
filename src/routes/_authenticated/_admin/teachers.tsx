import { createFileRoute, redirect } from '@tanstack/react-router'
import { BackLink } from '@/components/back-link'
import { getCurrentProfile } from '@/lib/profile'
import { TeachersList } from '@/features/teachers/components/teachers-list'

/**
 * The one page under `_admin/` that isn't shared with teachers — everything else
 * they see is what the admin sees. Hence a second guard here on top of the
 * layout's: `_admin` only asks whether you're staff.
 *
 * A teacher who types the URL is sent to their own homepage rather than shown a
 * "not allowed" page: there is nothing for them to do about it.
 */
export const Route = createFileRoute('/_authenticated/_admin/teachers')({
  beforeLoad: async () => {
    const profile = await getCurrentProfile()

    if (profile?.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  component: TeachersPage,
})

function TeachersPage() {
  return (
    <div className="min-h-svh bg-background p-6 text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <BackLink />
          <h1 className="mt-4 text-2xl font-semibold">Teachers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who can sign in to teach. Each one keeps their own students; the
            lesson library, the modules and the homework are shared.
          </p>
        </div>
        <TeachersList />
      </div>
    </div>
  )
}
