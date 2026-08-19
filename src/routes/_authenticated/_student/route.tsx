import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, isStaff } from '@/lib/profile'
import { fetchMyStudentAccess } from '@/lib/student-access'

/**
 * The student side of the app. Pathless, like `_admin`, and the mirror of it:
 * staff are sent back to their own homepage rather than shown a student page.
 *
 * The access row is loaded here and handed down through the route context, so
 * the pages below don't each re-fetch it.
 */
export const Route = createFileRoute('/_authenticated/_student')({
  beforeLoad: async () => {
    const profile = await getCurrentProfile()

    if (isStaff(profile)) {
      throw redirect({ to: '/lessons' })
    }

    const access = await fetchMyStudentAccess()

    // A deactivated student — or a signed-in account with no roster row at all,
    // which is what a stray public sign-up or a deactivated teacher looks like —
    // gets no app.
    if (!access || access.status !== 'active') {
      await supabase.auth.signOut()
      throw redirect({ to: '/login', search: { redirect: undefined } })
    }

    return { access }
  },
  component: () => <Outlet />,
})
