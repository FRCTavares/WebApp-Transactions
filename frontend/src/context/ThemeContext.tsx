import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from './themeContextValue'

const THEME_STORAGE_KEY = 'finance-theme-preference'


function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (storedValue === 'light' || storedValue === 'dark' || storedValue === 'system') {
    return storedValue
  }
  return 'system'
}

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    getStoredThemePreference,
  )
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.dataset.themePreference = themePreference
    document.documentElement.style.colorScheme = resolvedTheme
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  }, [themePreference, resolvedTheme])

  function setThemePreference(nextThemePreference: ThemePreference) {
    setThemePreferenceState(nextThemePreference)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextThemePreference)
  }

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
    }),
    [themePreference, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
