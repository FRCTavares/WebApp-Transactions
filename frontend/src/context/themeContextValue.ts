import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark'

export type ThemeContextValue = {
  themePreference: ThemePreference
  resolvedTheme: ThemePreference
  setThemePreference: (themePreference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
