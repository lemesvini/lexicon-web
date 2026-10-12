import { useCallback } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useHome } from "@/hooks/use-home";

/**
 * What every back arrow in the app does: return to the page the reader was on
 * before this one.
 *
 * Most pages are reached from more than one place, so a fixed destination would
 * be wrong as often as it was right — history is the only thing that knows
 * which it was. The fallback is not optional: on a pasted link or a refresh
 * there is nothing to go back to, and `history.back()` would either do nothing
 * or walk the reader out of the app, so it goes home instead.
 */
export function useGoBack() {
  const router = useRouter();
  const navigate = useNavigate();
  const { home } = useHome();

  return useCallback(() => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void navigate({ to: home });
  }, [router, navigate, home]);
}
