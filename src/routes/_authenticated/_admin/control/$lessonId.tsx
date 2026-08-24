import { useCallback, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { exportToSvg } from '@excalidraw/excalidraw'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  XIcon,
} from 'lucide-react'
import { BackButton } from '@/components/back-button'
import { Button } from '@/components/ui/button'
import { SlideView } from '@/features/blocks'
import { Whiteboard } from '@/features/presenter/components/whiteboard'
import { ConnectionBadge } from '@/features/presenter/components/connection-status'
import {
  BoardStrip,
  MAX_BOARDS,
  type Board,
} from '@/features/presenter/components/board-strip'
import { useLessonPresenter } from '@/features/presenter/use-lesson-presenter'
import { useResolvedLesson } from '@/features/presenter/use-resolved-lesson'

type ControlSearch = { groupId?: string }

export const Route = createFileRoute('/_authenticated/_admin/control/$lessonId')({
  // Mirrors the present route: the teacher's device has to be driving the same
  // deck the projector is showing.
  validateSearch: (search: Record<string, unknown>): ControlSearch => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
  component: ControlPage,
})

function ControlPage() {
  const { lessonId } = Route.useParams()
  const { groupId } = Route.useSearch()
  const { lesson, loading } = useResolvedLesson(lessonId, groupId)
  const slideCount = lesson?.slides.length ?? 0
  const {
    slideIndex,
    status,
    canPrev,
    canNext,
    goPrev,
    goNext,
    broadcastBoard,
    setWhiteboardActive,
  } = useLessonPresenter(lessonId, slideCount)

  const [boards, setBoards] = useState<Board[]>([
    { id: 'board-1', name: 'Board 1' },
  ])
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null

  // Elements live in a ref, not state: the editor's onChange fires constantly
  // while drawing, and re-rendering the control on each stroke both loops back
  // into Excalidraw's onChange and tanks performance. The strip only needs
  // id/name; each board's scene is keyed here by id.
  const boardElements = useRef<Record<string, unknown[]>>({ 'board-1': [] })

  // SVG thumbnails for the Stage Manager tiles, regenerated (debounced) as the
  // teacher draws so the previews stay live without exporting on every stroke.
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const regeneratePreview = useCallback(async (id: string) => {
    const els = boardElements.current[id] ?? []
    if (els.length === 0) {
      setPreviews((prev) => ({ ...prev, [id]: '' }))
      return
    }
    const svg = await exportToSvg({
      elements: els as Parameters<typeof exportToSvg>[0]['elements'],
      files: null,
      appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
      exportPadding: 8,
      skipInliningFonts: true,
    })
    const markup = new XMLSerializer().serializeToString(svg)
    setPreviews((prev) => ({
      ...prev,
      [id]: `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`,
    }))
  }, [])

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

  const slide = lesson.slides[slideIndex]

  function closeBoard() {
    if (activeBoardId) void regeneratePreview(activeBoardId)
    setActiveBoardId(null)
    setWhiteboardActive(false, [])
  }

  function selectBoard(id: string) {
    if (id === activeBoardId) {
      closeBoard()
      return
    }
    setActiveBoardId(id)
    setWhiteboardActive(true, boardElements.current[id] ?? [])
  }

  function addBoard() {
    if (boards.length >= MAX_BOARDS) return
    const n = boards.length + 1
    const board: Board = { id: `board-${n}`, name: `Board ${n}` }
    boardElements.current[board.id] = []
    setBoards((prev) => [...prev, board])
    setActiveBoardId(board.id)
    setWhiteboardActive(true, [])
  }

  function handleElementsChange(elements: unknown[]) {
    if (!activeBoardId) return
    const id = activeBoardId
    boardElements.current[id] = elements
    broadcastBoard(elements)

    // Debounce the (relatively expensive) SVG export away from the stroke path.
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => void regeneratePreview(id), 500)
  }

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <BackButton to="/lessons" label="Back to lessons" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{lesson.title}</span>
          <ConnectionBadge status={status} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Left column — slide + notes, or the active board's editor */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {activeBoard ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-sm font-medium">{activeBoard.name}</span>
                <Button variant="ghost" size="sm" onClick={closeBoard}>
                  <XIcon />
                  Close
                </Button>
              </div>
              <div className="relative min-h-0 flex-1">
                <Whiteboard
                  key={activeBoard.id}
                  mode="edit"
                  initialElements={boardElements.current[activeBoard.id]}
                  onElementsChange={handleElementsChange}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col gap-6 overflow-auto p-8">
              <div className="relative flex flex-1 items-center justify-center">
                <SlideView slide={slide} audience="teacher" />
              </div>
              {slide.teacherNotes && slide.teacherNotes.length > 0 && (
                <section className="shrink-0 space-y-2 rounded-lg border border-border bg-muted p-4">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Teacher notes
                  </h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {slide.teacherNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </section>

        {/* Right column — progress (top), boards (middle), nav (bottom) */}
        <aside className="flex w-64 shrink-0 flex-col gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums">
              {slideIndex + 1}
              <span className="text-muted-foreground">/{slideCount}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {slide.stage}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <BoardStrip
              boards={boards}
              activeId={activeBoardId}
              previews={previews}
              onSelect={selectBoard}
              onAdd={addBoard}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Previous slide"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1"
              onClick={goNext}
              disabled={!canNext}
              aria-label="Next slide"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
