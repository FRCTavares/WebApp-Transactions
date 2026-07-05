import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  setThemePreference: (themePreference: ThemePreference) => void
}

const THEME_STORAGE_KEY = 'finance-theme-preference'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (
    storedValue === 'light' ||
    storedValue === 'dark' ||
    storedValue === 'system'
  ) {
    return storedValue
  }

  return 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

function getResolvedTheme(themePreference: ThemePreference): ResolvedTheme {
  if (themePreference === 'system') {
    return getSystemTheme()
  }

  return themePreference
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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function handleSystemThemeChange() {
      setSystemTheme(getSystemTheme())
    }

    handleSystemThemeChange()
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  useEffect(() => {
    const nextResolvedTheme = getResolvedTheme(themePreference)

    document.documentElement.dataset.theme = nextResolvedTheme
    document.documentElement.dataset.themePreference = themePreference
    document.documentElement.style.colorScheme = nextResolvedTheme
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
