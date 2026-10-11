import { GOOGLE_CLIENT_ID } from './authMode'
import { saveGoogleSession, type GoogleSession } from './googleSession'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type CredentialResponse = { credential?: string }

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: CredentialResponse) => void
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
      disableAutoSelect: () => void
    }
  }
}

function googleOnWindow(): GoogleIdentity | undefined {
  return (window as Window & { google?: GoogleIdentity }).google
}

let loading: Promise<GoogleIdentity> | null = null

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = googleOnWindow()
  if (existing?.accounts?.id) return Promise.resolve(existing)
  if (loading) return loading

  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => {
      const loaded = googleOnWindow()
      if (loaded?.accounts?.id) resolve(loaded)
      else reject(new Error('Google sign-in did not load.'))
    }
    script.onerror = () => reject(new Error('Could not reach Google sign-in.'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })

  return loading
}

export async function exchangeGoogleCredential(credential: string): Promise<GoogleSession> {
  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // Non-JSON error body.
    }
    throw new Error(detail || `Sign-in failed (${response.status}).`)
  }

  const session = (await response.json()) as GoogleSession
  saveGoogleSession(session)
  return session
}

export async function renderGoogleButton(
  parent: HTMLElement,
  onError: (message: string) => void,
): Promise<void> {
  const google = await loadGoogleIdentity()

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (!response.credential) {
        onError('Google did not return a credential.')
        return
      }
      exchangeGoogleCredential(response.credential).catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Sign-in failed.')
      })
    },
  })

  google.accounts.id.renderButton(parent, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 280,
  })
}

export async function disableGoogleAutoSelect(): Promise<void> {
  try {
    ;(await loadGoogleIdentity()).accounts.id.disableAutoSelect()
  } catch {
    // Google unreachable: nothing to disable.
  }
}
