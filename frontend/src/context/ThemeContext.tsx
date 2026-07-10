import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark'
type StoredThemePreference = ThemePreference | 'system'

type ThemeContextValue = {
  themePreference: ThemePreference
  resolvedTheme: ThemePreference
  setThemePreference: (themePreference: ThemePreference) => void
}

const THEME_STORAGE_KEY = 'finance-theme-preference'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ThemePreference {
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

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY) as StoredThemePreference | null

  if (storedValue === 'light' || storedValue === 'dark') {
    return storedValue
  }

  if (storedValue === 'system') {
    return getSystemTheme()
  }

  return 'light'
}

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    getStoredThemePreference,
  )

  const resolvedTheme = themePreference

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

export function useTheme() {
  const value = useContext(ThemeContext)

  if (value === null) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}
