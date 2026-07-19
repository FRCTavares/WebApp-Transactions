import { createHmac } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', secret).update(signingInput).digest()

  return `${signingInput}.${base64url(signature)}`
}

export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile(path.join(import.meta.dirname, '.env.e2e.local'))
  } catch {
    // In CI, these are provided as real environment variables instead.
  }

  const secret = process.env.SUPABASE_JWT_SECRET
  const email = process.env.E2E_TEST_EMAIL
  const supabaseUrl = process.env.VITE_SUPABASE_URL

  if (!secret || !email || !supabaseUrl) {
    throw new Error(
      'e2e auth setup requires SUPABASE_JWT_SECRET, E2E_TEST_EMAIL, and '
      + 'VITE_SUPABASE_URL. Set them in frontend/e2e/.env.e2e.local (local) '
      + 'or as real environment variables (CI).',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const userId = '00000000-0000-0000-0000-0000000000e2'
  const oneDaySeconds = 60 * 60 * 24

  const accessToken = signHs256(
    {
      aud: 'authenticated',
      exp: now + oneDaySeconds,
      iat: now,
      sub: userId,
      email,
      role: 'authenticated',
    },
    secret,
  )

  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-fake-refresh-token',
    expires_at: now + oneDaySeconds,
    expires_in: oneDaySeconds,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://127.0.0.1:4173',
        localStorage: [{ name: storageKey, value: JSON.stringify(session) }],
      },
    ],
  }

  const authDir = path.join(import.meta.dirname, '.auth')
  mkdirSync(authDir, { recursive: true })
  writeFileSync(
    path.join(authDir, 'session.json'),
    JSON.stringify(storageState, null, 2),
  )
}
