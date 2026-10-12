import { createContext } from 'react'

/** The part of a signed-in user the app reads. */
export type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

export type AuthSession = {
  access_token: string
  user: AuthUser
}

export type AuthContextValue = {
  accessToken: string | null
  clearLocalSession: () => Promise<void>
  isAuthConfigured: boolean
  isAuthEnabled: boolean
  isLoading: boolean
  session: AuthSession | null
  signOut: () => Promise<void>
  user: AuthUser | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
