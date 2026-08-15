import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentProfile } from '@/lib/profile'

/**
 * The teacher side of the app. A pathless layout route, so every page under
 * `_admin/` keeps the URL it already had (`/students` is still `/students`) —
 * this only adds the role check in front of them.
 */
export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: async () => {
    const profile = await getCurrentProfile()

    if (profile?.role !== 'admin') {
      throw redirect({ to: '/learn' })
    }
  },
  component: () => <Outlet />,
})
