import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, setUnauthorizedHandler } from '../src/api/client'

describe('API session recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('clears an expired session and returns a controlled error', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Expired token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(apiGet('/api/me')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
