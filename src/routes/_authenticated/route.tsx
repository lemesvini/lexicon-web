import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { mustChangePassword } from '@/lib/profile'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    // Accounts created by an admin start on a temporary password. Nothing else
    // in the app is reachable until it has been replaced.
    if (
      mustChangePassword(data.session.user) &&
      location.pathname !== '/change-password'
    ) {
      throw redirect({ to: '/change-password' })
    }
  },
  component: () => <Outlet />,
})
