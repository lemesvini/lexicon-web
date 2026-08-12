import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AuthProvider>
      <ThemeProvider storageKey="lexicon-theme">
        <Outlet />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </ThemeProvider>
    </AuthProvider>
  )
}
