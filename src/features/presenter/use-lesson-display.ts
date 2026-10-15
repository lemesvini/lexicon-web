import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  boardPayload,
  EVENTS,
  gamePayload,
  lessonChannel,
  navPayload,
  syncPayload,
  type ConnectionStatus,
} from "@/features/presenter/realtime";
import { useArrowKeyNav } from "@/features/presenter/use-arrow-key-nav";
import { MinigameSync } from "@/features/minigames/sync";

type LessonDisplay = {
  slideIndex: number;
  /** Whether the whiteboard panel should be dropped down over the slide. */
  whiteboardActive: boolean;
  elements: unknown[];
  status: ConnectionStatus;
  /** The session's minigames, shared with the control. Null until the
   *  presentation is known. */
  minigames: MinigameSync | null;
};

/**
 * Display-side (Mac) mirror. Subscribes to the presentation's channel, follows
 * the control's navigation and whiteboard, and on every (re)connect asks the
 * control for the full current state so a reload or dropped connection never
 * leaves a blank screen — it just keeps the last slide until fresh state lands.
 *
 * Minigames go both ways: changes made at the projector are sent to the
 * control, and when the control is the one (re)joining, the display tells it
 * which slide is up and where every game's round is.
 *
 * `key` is the presentation (see `presentationKey`); nothing connects until it
 * is known.
 */
export function useLessonDisplay(
  key: string | null,
  slideCount: number,
): LessonDisplay {
  const [slideIndex, setSlideIndex] = useState(0);
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [elements, setElements] = useState<unknown[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const channelRef = useRef<ReturnType<typeof lessonChannel> | null>(null);
  // Read by the state-request handler, which outlives any one render.
  const slideRef = useRef(0);
  useEffect(() => {
    slideRef.current = slideIndex;
  }, [slideIndex]);

  const minigames = useMemo(() => (key ? new MinigameSync(key) : null), [key]);

  useEffect(() => {
    if (!key || !minigames) return;
    const channel = lessonChannel(key);
    channelRef.current = channel;
    const detach = minigames.attach((payload) =>
      channel.send({ type: "broadcast", event: EVENTS.game, payload }),
    );

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
        minigames.adopt(parsed.data.games);
      }
    });

    channel.on("broadcast", { event: EVENTS.stateRequest }, () => {
      channel.send({
        type: "broadcast",
        event: EVENTS.state,
        payload: { slide: slideRef.current, games: minigames.snapshot() },
      });
    });

    channel.on("broadcast", { event: EVENTS.game }, ({ payload }) => {
      const parsed = gamePayload.safeParse(payload);
      if (parsed.success) minigames.receive(parsed.data);
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
      detach();
      channelRef.current = null;
      void channel.unsubscribe();
    };
  }, [key, minigames]);

  // Standalone keyboard nav for when no control page is driving the deck. If a
  // control connects, its nav/sync broadcasts override this local index.
  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSlideIndex((i) => Math.min(i + 1, slideCount - 1));
  }, [slideCount]);
  useArrowKeyNav(goPrev, goNext);

  return { slideIndex, whiteboardActive, elements, status, minigames };
}
