import { createContext } from 'react'

export type Theme = 'dark' | 'light' | 'system'

/** The order themes are offered — and cycled — in. */
export const THEME_ORDER = ['light', 'dark', 'system'] as const satisfies readonly Theme[]

/** The theme that follows `current` in {@link THEME_ORDER}. */
export function nextTheme(current: Theme): Theme {
  const index = THEME_ORDER.indexOf(current as (typeof THEME_ORDER)[number])
  return THEME_ORDER[(index + 1) % THEME_ORDER.length]
}

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  setTheme: () => null,
})
