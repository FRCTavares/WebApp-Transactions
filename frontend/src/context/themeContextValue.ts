import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export type ThemeContextValue = {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  setThemePreference: (themePreference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
