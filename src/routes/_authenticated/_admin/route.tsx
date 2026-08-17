import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentProfile, isStaff } from '@/lib/profile'

/**
 * The teacher side of the app — both roles that teach: the admin and every
 * teacher they've added. A pathless layout route, so every page under `_admin/`
 * keeps the URL it already had (`/students` is still `/students`) — this only
 * adds the role check in front of them.
 *
 * The one page that isn't shared is `/teachers`, which carries its own
 * admin-only guard.
 */
export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: async () => {
    const profile = await getCurrentProfile()

    if (!isStaff(profile)) {
      throw redirect({ to: '/learn' })
    }
  },
  component: () => <Outlet />,
})
