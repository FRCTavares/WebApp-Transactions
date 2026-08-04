import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { ThemeProvider } from '../src/context/ThemeContext'

const mocked = vi.hoisted(() => ({
  accessStatus: {
    error: null as string | null,
    isLoading: false,
    status: null as 'allowed' | 'pending' | 'denied' | null,
  },
  auth: {
    accessToken: null as string | null,
    isAuthConfigured: true,
    isAuthEnabled: false,
    isLoading: false,
    session: null as object | null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    user: null as { email: string } | null,
  },
}))

vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mocked.auth }))
vi.mock('../src/hooks/useAccessStatus', () => ({
  useAccessStatus: () => mocked.accessStatus,
}))

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
    mocked.auth.user = null
    mocked.accessStatus.error = null
    mocked.accessStatus.isLoading = false
    mocked.accessStatus.status = null
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

  it('blocks a signed-in account still awaiting approval', () => {
    mocked.auth.isAuthEnabled = true
    mocked.auth.session = {}
    mocked.auth.user = { email: 'new@example.com' }
    mocked.accessStatus.status = 'pending'
    renderApp()
    expect(screen.getByRole('heading', { name: 'Waiting for approval' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument()
  })

  it('blocks a signed-in account that was denied', () => {
    mocked.auth.isAuthEnabled = true
    mocked.auth.session = {}
    mocked.auth.user = { email: 'denied@example.com' }
    mocked.accessStatus.status = 'denied'
    renderApp()
    expect(
      screen.getByRole('heading', { name: "This account can't use the tracker" }),
    ).toBeInTheDocument()
  })

  it('shows the app once access status resolves to allowed', () => {
    window.history.replaceState({}, '', '/dashboard')
    mocked.auth.isAuthEnabled = true
    mocked.auth.session = {}
    mocked.auth.user = { email: 'me@example.com' }
    mocked.accessStatus.status = 'allowed'
    renderApp()
    expect(
      screen.queryByRole('heading', { name: 'Waiting for approval' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sign in with Google' }),
    ).not.toBeInTheDocument()
  })

  it('does not block the app while the status check is still loading or unavailable (e.g. offline)', () => {
    window.history.replaceState({}, '', '/dashboard')
    mocked.auth.isAuthEnabled = true
    mocked.auth.session = {}
    mocked.auth.user = { email: 'me@example.com' }
    mocked.accessStatus.status = null
    mocked.accessStatus.isLoading = true
    renderApp()
    expect(
      screen.queryByRole('heading', { name: 'Waiting for approval' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sign in with Google' }),
    ).not.toBeInTheDocument()
  })
})
