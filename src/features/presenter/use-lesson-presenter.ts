import { useCallback, useEffect, useRef, useState } from "react";
import {
  EVENTS,
  lessonChannel,
  type ConnectionStatus,
} from "@/features/presenter/realtime";
import { useArrowKeyNav } from "@/features/presenter/use-arrow-key-nav";

const BOARD_THROTTLE_MS = 80;

type LessonPresenter = {
  slideIndex: number;
  status: ConnectionStatus;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  /** Live drawing stream while a board is open (throttled ~80ms). */
  broadcastBoard: (elements: unknown[]) => void;
  /** Open/close the whiteboard on the display; sent immediately. */
  setWhiteboardActive: (active: boolean, elements: unknown[]) => void;
};

/**
 * Control-side (iPad) presenter state. Owns the current slide index, broadcasts
 * navigation and whiteboard state, and answers a display's sync-request with
 * the full current state so late joiners catch up.
 */
export function useLessonPresenter(
  lessonId: string,
  slideCount: number,
): LessonPresenter {
  const [slideIndex, setSlideIndex] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // Refs mirror the latest state so the (long-lived) sync-request handler and
  // the throttle timer always read current values without re-subscribing.
  const channelRef = useRef<ReturnType<typeof lessonChannel> | null>(null);
  const slideRef = useRef(0);
  const activeRef = useRef(false);
  const elementsRef = useRef<unknown[]>([]);
  const throttleRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    lastSent: number;
  }>({ timer: null, lastSent: 0 });

  const clearThrottle = () => {
    const t = throttleRef.current.timer;
    if (t) {
      clearTimeout(t);
      throttleRef.current.timer = null;
    }
  };

  useEffect(() => {
    const channel = lessonChannel(lessonId);
    channelRef.current = channel;

    channel.on("broadcast", { event: EVENTS.syncRequest }, () => {
      channel.send({
        type: "broadcast",
        event: EVENTS.sync,
        payload: {
          slide: slideRef.current,
          active: activeRef.current,
          elements: elementsRef.current,
        },
      });
    });

    channel.subscribe((s) => {
      setStatus(s === "SUBSCRIBED" ? "connected" : "disconnected");
    });

    return () => {
      clearThrottle();
      channelRef.current = null;
      void channel.unsubscribe();
    };
  }, [lessonId]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, slideCount - 1));
      slideRef.current = clamped;
      setSlideIndex(clamped);
      channelRef.current?.send({
        type: "broadcast",
        event: EVENTS.nav,
        payload: { slide: clamped },
      });
    },
    [slideCount],
  );

  const goPrev = useCallback(() => goTo(slideRef.current - 1), [goTo]);
  const goNext = useCallback(() => goTo(slideRef.current + 1), [goTo]);

  useArrowKeyNav(goPrev, goNext);

  const sendBoard = useCallback(() => {
    throttleRef.current.lastSent = Date.now();
    channelRef.current?.send({
      type: "broadcast",
      event: EVENTS.board,
      payload: { active: activeRef.current, elements: elementsRef.current },
    });
  }, []);

  const broadcastBoard = useCallback(
    (elements: unknown[]) => {
      activeRef.current = true;
      elementsRef.current = elements;

      const elapsed = Date.now() - throttleRef.current.lastSent;
      if (elapsed >= BOARD_THROTTLE_MS) {
        clearThrottle();
        sendBoard();
      } else if (!throttleRef.current.timer) {
        // Trailing edge — coalesce the burst into one send.
        throttleRef.current.timer = setTimeout(() => {
          throttleRef.current.timer = null;
          sendBoard();
        }, BOARD_THROTTLE_MS - elapsed);
      }
    },
    [sendBoard],
  );

  const setWhiteboardActive = useCallback(
    (active: boolean, elements: unknown[]) => {
      activeRef.current = active;
      elementsRef.current = elements;
      clearThrottle();
      sendBoard();
    },
    [sendBoard],
  );

  return {
    slideIndex,
    status,
    canPrev: slideIndex > 0,
    canNext: slideIndex < slideCount - 1,
    goPrev,
    goNext,
    broadcastBoard,
    setWhiteboardActive,
  };
}
