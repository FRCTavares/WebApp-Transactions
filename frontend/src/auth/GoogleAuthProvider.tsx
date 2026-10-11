import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setAccessTokenProvider, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue, type AuthSession } from './authContext'
import { GOOGLE_CLIENT_ID } from './authMode'
import { disableGoogleAutoSelect } from './googleIdentity'
import {
  clearGoogleSession,
  currentGoogleSession,
  onGoogleSessionChange,
  type GoogleSession,
} from './googleSession'

async function clearOfflineApiCache() {
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => null)
  registration?.active?.postMessage({ type: 'CLEAR_API_CACHE' })
}

function toAuthSession(session: GoogleSession | null): AuthSession | null {
  if (!session) return null
  return {
    access_token: session.token,
    user: {
      id: session.user.id,
      email: session.user.email,
      user_metadata: { name: session.user.displayName },
    },
  }
}

/** Sign-in for the self-hosted deployment: Google proves who you are once, then this app's API issues the session. */
export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<GoogleSession | null>(() => currentGoogleSession())

  useEffect(() => {
    setAccessTokenProvider(async () => currentGoogleSession()?.token ?? null)
    setUnauthorizedHandler(async () => {
      clearGoogleSession()
      void clearOfflineApiCache()
    })
    const unsubscribe = onGoogleSessionChange(() => setStored(currentGoogleSession()))

    return () => {
      unsubscribe()
      setAccessTokenProvider(null)
      setUnauthorizedHandler(null)
    }
  }, [])

  const session = useMemo(() => toAuthSession(stored), [stored])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      clearLocalSession: async () => {
        clearGoogleSession()
        await clearOfflineApiCache()
      },
      isAuthConfigured: GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com'),
      isAuthEnabled: true,
      isLoading: false,
      session,
      // The Google button on the sign-in screen does the sign-in itself.
      signInWithGoogle: async () => {},
      signOut: async () => {
        await clearOfflineApiCache()
        clearGoogleSession()
        await disableGoogleAutoSelect()
      },
      user: session?.user ?? null,
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
