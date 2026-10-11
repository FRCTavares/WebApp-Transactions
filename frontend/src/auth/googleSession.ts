export type GoogleSessionUser = {
  id: string
  email: string
  displayName: string
}

export type GoogleSession = {
  token: string
  expiresAt: string
  user: GoogleSessionUser
}

const STORAGE_KEY = 'finance.session.v1'

const listeners = new Set<() => void>()

// Fallback when localStorage is blocked; lasts until the page reloads.
let memorySession: GoogleSession | null = null

function notify(): void {
  listeners.forEach((listener) => listener())
}

function isSession(value: unknown): value is GoogleSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Partial<GoogleSession>
  return (
    typeof session.token === 'string' &&
    session.token.length > 0 &&
    typeof session.expiresAt === 'string' &&
    typeof session.user?.id === 'string' &&
    typeof session.user?.email === 'string' &&
    typeof session.user?.displayName === 'string'
  )
}

function readStored(now: number): GoogleSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed) || Date.parse(parsed.expiresAt) <= now) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function currentGoogleSession(now: number = Date.now()): GoogleSession | null {
  const stored = readStored(now)
  if (stored) return stored
  if (memorySession && Date.parse(memorySession.expiresAt) > now) return memorySession
  return null
}

export function saveGoogleSession(session: GoogleSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    memorySession = session
  }
  notify()
}

export function clearGoogleSession(): void {
  memorySession = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
  notify()
}

export function onGoogleSessionChange(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
