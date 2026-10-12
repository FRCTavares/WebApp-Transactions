// Sign-in is Google Identity Services -> POST /api/auth/google -> a session token issued by this app's own API.
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
