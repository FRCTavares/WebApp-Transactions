import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { ThemeProvider } from '../src/context/ThemeContext'

const mocked = vi.hoisted(() => ({
  auth: {
    accessToken: null as string | null,
    isAuthConfigured: true,
    isAuthEnabled: false,
    isLoading: false,
    session: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    user: null,
  },
}))

vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mocked.auth }))

describe('application authentication states', () => {
  function renderApp() {
    return render(<ThemeProvider><BrowserRouter><App /></BrowserRouter></ThemeProvider>)
  }

  beforeEach(() => {
    window.history.replaceState({}, '', '/settings')
    mocked.auth.isAuthConfigured = true
    mocked.auth.isAuthEnabled = false
    mocked.auth.isLoading = false
    mocked.auth.session = null
  })

  it('supports explicit local/disabled authentication mode', () => {
    renderApp()
    expect(
      screen.getByText('Local mode', { selector: 'strong' }),
    ).toBeInTheDocument()
  })

  it('shows a controlled misconfiguration state', () => {
    mocked.auth.isAuthEnabled = true
    mocked.auth.isAuthConfigured = false
    renderApp()
    expect(screen.getByRole('heading', { name: 'Supabase auth is not configured' })).toBeInTheDocument()
  })

  it('requires sign-in when auth is configured without a session', () => {
    mocked.auth.isAuthEnabled = true
    renderApp()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })
})
