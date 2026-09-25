import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2Icon, MaximizeIcon, MinimizeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showsBrand } from '@/lib/lessons'
import { BrandMark, SlideView } from '@/features/blocks'
import { Whiteboard } from '@/features/presenter/components/whiteboard'
import { ConnectionBadge } from '@/features/presenter/components/connection-status'
import { useLessonDisplay } from '@/features/presenter/use-lesson-display'
import { useResolvedLesson } from '@/features/presenter/use-resolved-lesson'

type PresentSearch = { groupId?: string }

export const Route = createFileRoute('/_authenticated/_admin/present/$lessonId')({
  // Presenting *for a group* shows that group's own copy of the lesson — the
  // shared deck plus whatever advanced context was added for this class. Without
  // it, the shared lesson, exactly as before.
  validateSearch: (search: Record<string, unknown>): PresentSearch => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
  component: PresentPage,
})

/** Toggles browser fullscreen — the presenter is meant to run edge-to-edge on
 *  the projector, so this stays out of the way and only surfaces on hover. */
function FullscreenToggle({ className }: { className?: string }) {
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    sync()
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFull ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFull ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-card/80 p-2.5 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground',
        className,
      )}
    >
      {isFull ? (
        <MinimizeIcon className="size-5" />
      ) : (
        <MaximizeIcon className="size-5" />
      )}
    </button>
  )
}

function PresentPage() {
  const { lessonId } = Route.useParams()
  const { groupId } = Route.useSearch()
  const { lesson, loading } = useResolvedLesson(lessonId, groupId)
  const { slideIndex, whiteboardActive, elements, status } =
    useLessonDisplay(lessonId, lesson?.slides.length ?? 0)

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <Loader2Icon className="size-6 animate-spin" />
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <p>Lesson not found: {lessonId}</p>
      </div>
    )
  }

  // Clamp so a stale index (e.g. control on a longer lesson) never blanks out.
  const slide = lesson.slides[Math.min(slideIndex, lesson.slides.length - 1)]

  return (
    <div className="group relative min-h-svh overflow-hidden bg-background text-foreground">
      {/* Fullscreen toggle — hidden until the presenter is hovered, so it never
          distracts from the projected slide. */}
      <FullscreenToggle className="absolute right-4 top-4 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100" />

      {/* Brand mark — at the top so the room always knows whose class this is.
          Sits behind the whiteboard, which covers it when open. Optional per
          slide and per document (`hideBrand`), and dropped on an Advanced
          Context slide, whose corner lockup already carries the wordmark. */}
      {showsBrand(lesson, slide) && <BrandMark />}

      {/* Slide — the only thing the presenter ever shows on its own. Positioned
          so SlideView's stage layer (and any wallpaper) fills the screen. */}
      <div className="relative min-h-svh">
        <SlideView slide={slide} audience="student" />
      </div>

      {/* Whiteboard — white panel that drops from the top (flush) with a 3%
          margin on the sides and bottom. Stays mounted so it can mirror live;
          just slides out of view when closed. */}
      <div
        aria-hidden={!whiteboardActive}
        className={cn(
          'absolute inset-x-[3%] bottom-[3%] top-0 overflow-hidden rounded-b-2xl bg-card shadow-2xl transition-transform duration-500 ease-out',
          whiteboardActive
            ? 'translate-y-0'
            : 'pointer-events-none -translate-y-[103%]',
        )}
      >
        <Whiteboard mode="view" elements={elements} />
      </div>

      {status !== 'connected' && (
        <ConnectionBadge
          status={status}
          className="absolute bottom-4 right-6 z-10 rounded-full bg-card px-3 py-1.5 shadow"
        />
      )}
    </div>
  )
}
