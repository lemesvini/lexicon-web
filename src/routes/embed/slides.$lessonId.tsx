import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { LessonSlides } from "@/features/learn/components/slides-viewer";
import { env } from "@/lib/env";
import { fetchStudentPresentation } from "@/lib/student-content";
import { ThemeProviderContext, type Theme } from "@/lib/theme-context";

/**
 * The class deck alone, for the mobile app to show in a WebView: the same
 * viewer a student opens from their lesson page, so the slides keep the
 * projector's 16:9 stage on a phone too — upright or on its side.
 *
 * Outside `_authenticated` on purpose. The app has its own Supabase session and
 * hands over only its access token, in the URL's fragment (never sent to a
 * server): `#token=<jwt>&theme=dark`. The deck is read with that token and
 * nothing else — no session is started here, so nothing is stored and nothing
 * refreshes. Refreshing would rotate the app's refresh token under it and sign
 * the student out of the app.
 *
 * Closing posts `{"type":"close"}` to the app, which dismisses the screen.
 */
export const Route = createFileRoute("/embed/slides/$lessonId")({
  component: EmbedSlides,
});

type Handoff = { token: string | null; theme: Theme | null };

/** What the app put in the fragment, read once and then wiped from the URL. */
function readHandoff(): Handoff {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const theme = params.get("theme");
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }
  return {
    token: params.get("token"),
    theme: theme === "dark" || theme === "light" ? theme : null,
  };
}

declare global {
  interface Window {
    /** Injected by react-native-webview. */
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

function EmbedSlides() {
  const { lessonId } = Route.useParams();
  const [handoff] = React.useState(readHandoff);
  const { setTheme } = React.useContext(ThemeProviderContext);

  // The app's scheme, not whatever the WebView guesses.
  React.useEffect(() => {
    if (handoff.theme) setTheme(handoff.theme);
  }, [handoff.theme, setTheme]);

  const fetchDeck = React.useMemo(() => {
    const { token } = handoff;
    if (!token) return null;
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      accessToken: async () => token,
    });
    return (id: string) => fetchStudentPresentation(id, client);
  }, [handoff]);

  const close = React.useCallback(() => {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "close" }));
  }, []);

  if (!fetchDeck) {
    return (
      <div className="flex h-svh items-center justify-center bg-background px-8 text-center text-sm text-muted-foreground">
        <p>Couldn’t load the slides. Please try again.</p>
      </div>
    );
  }

  return <LessonSlides lessonId={lessonId} onClose={close} fetchDeck={fetchDeck} />;
}
