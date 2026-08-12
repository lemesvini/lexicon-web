import { createFileRoute } from '@tanstack/react-router'
import { BackLink } from '@/components/back-link'

export const Route = createFileRoute('/_authenticated/students')({
  component: StudentsPage,
})

function StudentsPage() {
  return (
    <div className="min-h-svh bg-background p-6 text-foreground">
      <BackLink />
      <h1 className="mt-4 text-2xl font-semibold">Students</h1>
    </div>
  )
}
