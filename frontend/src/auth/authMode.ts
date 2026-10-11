// "supabase" (default) signs in through Supabase Auth. "google" is the
// self-hosted flow: Google Identity Services -> POST /api/auth/google -> a
// session token issued by this app's own API.
export const AUTH_MODE: 'supabase' | 'google' =
  import.meta.env.VITE_AUTH_MODE === 'google' ? 'google' : 'supabase'

export const usesGoogleAuth = AUTH_MODE === 'google'

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
