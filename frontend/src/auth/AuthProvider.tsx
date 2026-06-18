import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { setAccessTokenProvider } from '../api/client'
import { isSupabaseAuthConfigured, supabase } from './supabaseClient'

type AuthContextValue = {
  accessToken: string | null
  isAuthConfigured: boolean
  isLoading: boolean
  session: Session | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!supabase) {
        return null
      }

      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    })

    if (!supabase) {
      setIsLoading(false)
      return
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
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      isAuthConfigured: isSupabaseAuthConfigured,
      isLoading,
      session,
      signInWithGoogle: async () => {
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

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
