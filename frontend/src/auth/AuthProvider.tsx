import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '../api/client'
import { AuthContext, type AuthContextValue } from './authContext'
import { isSupabaseAuthConfigured, isSupabaseAuthEnabled, supabase } from './supabaseClient'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!supabase) {
        return null
      }

      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    })

    setUnauthorizedHandler(async () => {
      setSession(null)

      if (!supabase) {
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
    })

    if (!supabase) {
      return () => {
        setAccessTokenProvider(null)
        setUnauthorizedHandler(null)
      }
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session)
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setIsLoading(false)
      },
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
      setAccessTokenProvider(null)
      setUnauthorizedHandler(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      isAuthConfigured: isSupabaseAuthConfigured,
      isAuthEnabled: isSupabaseAuthEnabled,
      isLoading,
      session,
      signInWithGoogle: async () => {
        if (!isSupabaseAuthEnabled) {
          throw new Error('Supabase authentication is disabled.')
        }

        if (!supabase) {
          throw new Error('Supabase authentication is not configured.')
        }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        })

        if (error) {
          throw error
        }
      },
      signOut: async () => {
        if (!supabase) {
          return
        }

        const { error } = await supabase.auth.signOut()

        if (error) {
          throw error
        }
      },
      user: session?.user ?? null,
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
