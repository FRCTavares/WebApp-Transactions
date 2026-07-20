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

// Must stay in sync with --theme-bg in styles/theme.css and styles/theme-dark.css,
// and with the pre-JS fallback <meta name="theme-color"> pair in index.html.
const THEME_COLOURS: Record<ResolvedTheme, string> = {
  light: '#f5f5f7',
  dark: '#09090b',
}

// index.html ships two media-scoped theme-color tags so the browser chrome is
// correct before React mounts. Once the resolved theme is known those are
// replaced by a single unscoped tag, otherwise an explicit light/dark choice
// that disagrees with the OS preference would be ignored by the browser.
function applyThemeColour(resolvedTheme: ResolvedTheme) {
  const head = document.head
  head
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((tag) => tag.remove())

  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = THEME_COLOURS[resolvedTheme]
  head.appendChild(meta)
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
    applyThemeColour(resolvedTheme)
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
