import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/lessons">
        <ArrowLeft />
        Back
      </Link>
    </Button>
  )
}
