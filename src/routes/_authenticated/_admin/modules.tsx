import { createFileRoute } from '@tanstack/react-router'
import { BackLink } from '@/components/back-link'
import { ModulesBoard } from '@/features/modules/components/modules-board'

export const Route = createFileRoute('/_authenticated/_admin/modules')({
  component: ModulesPage,
})

function ModulesPage() {
  return (
    <div className="min-h-svh bg-background p-6 text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <BackLink />
          <h1 className="mt-4 text-2xl font-semibold">Modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The curriculum a student’s access is pinned to.
          </p>
        </div>
        <ModulesBoard />
      </div>
    </div>
  )
}
