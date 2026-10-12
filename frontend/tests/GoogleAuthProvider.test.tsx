import { cleanup, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '../src/api/client'
import { GoogleAuthProvider } from '../src/auth/GoogleAuthProvider'
import { saveGoogleSession } from '../src/auth/googleSession'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('GoogleAuthProvider', () => {
  it('has the token ready for a child that requests data as soon as it mounts', async () => {
    saveGoogleSession({
      token: 'session-token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'u', email: 'a@b.c', displayName: 'A' },
    })
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    function Child() {
      useEffect(() => {
        void apiGet('/api/health')
      }, [])
      return null
    }
    render(
      <GoogleAuthProvider>
        <Child />
      </GoogleAuthProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const headers = new Headers(calls[0]?.[1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer session-token')
  })
})
