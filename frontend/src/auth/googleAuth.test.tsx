import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleAuthProvider } from './GoogleAuthProvider'
import { useAuth } from '../hooks/useAuth'
import {
  clearGoogleSession,
  currentGoogleSession,
  saveGoogleSession,
  type GoogleSession,
} from './googleSession'
import { apiGet } from '../api/client'

function session(overrides: Partial<GoogleSession> = {}): GoogleSession {
  return {
    token: 'v1.payload.signature',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: 'user-1', email: 'me@example.com', displayName: 'Me' },
    ...overrides,
  }
}

function Probe() {
  const { user, isAuthEnabled, session: current } = useAuth()
  return (
    <p>
      {isAuthEnabled ? 'enabled' : 'disabled'}|{user?.email ?? 'nobody'}|
      {String(user?.user_metadata?.name ?? '')}|{current?.access_token ?? 'no-token'}
    </p>
  )
}

describe('Google session storage', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => clearGoogleSession())

  it('stores, reads and clears a session', () => {
    saveGoogleSession(session())
    expect(currentGoogleSession()?.user.email).toBe('me@example.com')

    clearGoogleSession()
    expect(currentGoogleSession()).toBeNull()
  })

  it('drops an expired session', () => {
    saveGoogleSession(session({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
    expect(currentGoogleSession()).toBeNull()
  })

  it('ignores malformed stored data', () => {
    window.localStorage.setItem('finance.session.v1', '{"token":1}')
    expect(currentGoogleSession()).toBeNull()
  })
})

describe('GoogleAuthProvider', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => clearGoogleSession())

  it('exposes the signed-in user, follows sign-in and sign-out, and feeds the API token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', { status: 200 }))
    const authorization = () =>
      new Headers((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).headers).get('Authorization')

    render(
      <GoogleAuthProvider>
        <Probe />
      </GoogleAuthProvider>,
    )
    expect(screen.getByText('enabled|nobody||no-token')).toBeTruthy()

    act(() => saveGoogleSession(session()))
    expect(screen.getByText('enabled|me@example.com|Me|v1.payload.signature')).toBeTruthy()
    await apiGet('/api/me')
    expect(authorization()).toBe('Bearer v1.payload.signature')

    act(() => clearGoogleSession())
    expect(screen.getByText('enabled|nobody||no-token')).toBeTruthy()
    await apiGet('/api/me')
    expect(authorization()).toBeNull()
  })
})
