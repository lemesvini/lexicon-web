import { useCallback, useEffect, useState } from "react";
import {
  boardPayload,
  EVENTS,
  lessonChannel,
  navPayload,
  syncPayload,
  type ConnectionStatus,
} from "@/features/presenter/realtime";
import { useArrowKeyNav } from "@/features/presenter/use-arrow-key-nav";

type LessonDisplay = {
  slideIndex: number;
  /** Whether the whiteboard panel should be dropped down over the slide. */
  whiteboardActive: boolean;
  elements: unknown[];
  status: ConnectionStatus;
};

/**
 * Display-side (Mac) mirror. Subscribes to the lesson channel, follows the
 * control's navigation and whiteboard, and on every (re)connect asks the
 * control for the full current state so a reload or dropped connection never
 * leaves a blank screen — it just keeps the last slide until fresh state lands.
 */
export function useLessonDisplay(
  lessonId: string,
  slideCount: number,
): LessonDisplay {
  const [slideIndex, setSlideIndex] = useState(0);
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [elements, setElements] = useState<unknown[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const channel = lessonChannel(lessonId);

    channel.on("broadcast", { event: EVENTS.nav }, ({ payload }) => {
      const parsed = navPayload.safeParse(payload);
      if (parsed.success) setSlideIndex(parsed.data.slide);
    });

    channel.on("broadcast", { event: EVENTS.board }, ({ payload }) => {
      const parsed = boardPayload.safeParse(payload);
      if (parsed.success) {
        setWhiteboardActive(parsed.data.active);
        setElements(parsed.data.elements);
      }
    });

    channel.on("broadcast", { event: EVENTS.sync }, ({ payload }) => {
      const parsed = syncPayload.safeParse(payload);
      if (parsed.success) {
        setSlideIndex(parsed.data.slide);
        setWhiteboardActive(parsed.data.active);
        setElements(parsed.data.elements);
      }
    });

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus("connected");
        // Ask the control for the current state now that we're on the channel.
        channel.send({
          type: "broadcast",
          event: EVENTS.syncRequest,
          payload: {},
        });
      } else {
        setStatus("disconnected");
      }
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [lessonId]);

  // Standalone keyboard nav for when no control page is driving the deck. If a
  // control connects, its nav/sync broadcasts override this local index.
  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSlideIndex((i) => Math.min(i + 1, slideCount - 1));
  }, [slideCount]);
  useArrowKeyNav(goPrev, goNext);

  return { slideIndex, whiteboardActive, elements, status };
}
