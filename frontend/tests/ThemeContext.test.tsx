import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../src/context/ThemeContext'
import { useTheme } from '../src/hooks/useTheme'

const STORAGE_KEY = 'finance-theme-preference'

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

function mockMatchMedia({
  dark = false,
  reducedMotion = false,
}: {
  dark?: boolean
  reducedMotion?: boolean
} = {}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches:
        query === '(prefers-color-scheme: dark)'
          ? dark
          : query === '(prefers-reduced-motion: reduce)'
            ? reducedMotion
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('ThemeProvider transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    document.documentElement.classList.remove('theme-transitioning')
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.themePreference
    mockMatchMedia()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.localStorage.clear()
    document.documentElement.classList.remove('theme-transitioning')
  })

  it('sets the browser theme colour from the semantic background token', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn().mockReturnValue('rgb(245, 245, 247)'),
    } as unknown as CSSStyleDeclaration)
    window.localStorage.setItem(STORAGE_KEY, 'light')

    renderHook(() => useTheme(), { wrapper })

    const themeColourTags = document.head.querySelectorAll(
      'meta[name="theme-color"]',
    )

    expect(themeColourTags).toHaveLength(1)
    expect(themeColourTags[0]).toHaveAttribute(
      'content',
      'rgb(245, 245, 247)',
    )
  })

  it('does not transition during the initial theme application', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light')

    renderHook(() => useTheme(), { wrapper })

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(
      document.documentElement.classList.contains('theme-transitioning'),
    ).toBe(false)
  })

  it('temporarily enables transitions when the resolved theme changes', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setThemePreference('dark')
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      document.documentElement.classList.contains('theme-transitioning'),
    ).toBe(true)

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(
      document.documentElement.classList.contains('theme-transitioning'),
    ).toBe(false)
  })

  it('does not enable transitions when reduced motion is requested', () => {
    mockMatchMedia({ reducedMotion: true })
    window.localStorage.setItem(STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setThemePreference('dark')
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      document.documentElement.classList.contains('theme-transitioning'),
    ).toBe(false)
  })
})
