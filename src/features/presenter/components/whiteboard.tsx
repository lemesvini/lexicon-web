import { useCallback, useEffect, useMemo, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// Excalidraw's element/api types aren't cleanly re-exported, so we derive them
// from the component's own props. The realtime layer speaks `unknown[]`; we
// cast at this single boundary where the elements actually re-enter Excalidraw.
type ExcalidrawProps = React.ComponentProps<typeof Excalidraw>;
type ExcalidrawAPI = Parameters<NonNullable<ExcalidrawProps["excalidrawAPI"]>>[0];
type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type SceneElements = Parameters<OnChange>[0];

type WhiteboardProps =
  | {
      mode: "edit";
      /** Called on every change with the full element set (control throttles). */
      onElementsChange: (elements: unknown[]) => void;
      initialElements?: readonly unknown[];
    }
  | {
      mode: "view";
      /** Elements to mirror; applied via updateScene on change. */
      elements: readonly unknown[];
    };

/**
 * White Excalidraw surface used two ways:
 * - control (`edit`): teacher draws; changes bubble up via onElementsChange.
 * - display (`view`): read-only mirror, no toolbar.
 *
 * Excalidraw fires onChange in response to prop-driven re-renders, so every
 * prop it receives here is kept referentially stable — otherwise a parent
 * re-render feeds back into onChange and loops. The parent must remount this
 * (via `key`) to load a different board's initialElements.
 */
export function Whiteboard(props: WhiteboardProps) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  // Latest onChange callback held in a ref so `handleChange` stays stable.
  const onChangeRef = useRef<((elements: unknown[]) => void) | undefined>(
    undefined,
  );
  onChangeRef.current =
    props.mode === "edit" ? props.onElementsChange : undefined;

  const viewElements = props.mode === "view" ? props.elements : null;
  useEffect(() => {
    if (viewElements) {
      apiRef.current?.updateScene({ elements: viewElements as SceneElements });
    }
  }, [viewElements]);

  const handleChange = useCallback<OnChange>((elements) => {
    onChangeRef.current?.(elements as unknown[]);
  }, []);

  const setApi = useCallback((api: ExcalidrawAPI | null) => {
    apiRef.current = api;
  }, []);

  // Read once at mount — this component is keyed per board by the parent.
  const initialData = useMemo(
    () => ({
      elements: (props.mode === "edit" ? props.initialElements : undefined) as
        | SceneElements
        | undefined,
      appState: { viewBackgroundColor: "#ffffff" },
      scrollToContent: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        changeViewBackgroundColor: false,
        export: false as const,
        loadScene: false,
        saveToActiveFile: false,
        saveAsImage: false,
        toggleTheme: false,
        clearCanvas: props.mode === "edit",
      },
    }),
    [props.mode],
  );

  return (
    // touch-action:none — required on iPad Safari or it hijacks pen gestures.
    <div className="h-full w-full" style={{ touchAction: "none" }}>
      <Excalidraw
        excalidrawAPI={setApi}
        viewModeEnabled={props.mode === "view"}
        gridModeEnabled={false}
        onChange={props.mode === "edit" ? handleChange : undefined}
        initialData={initialData}
        UIOptions={uiOptions}
      />
    </div>
  );
}
