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

/** A session token in the format the API issues (`v1.<payload>.<HMAC-SHA256 signature>`). */
function issueSessionToken(claims: Record<string, unknown>, secret: string): string {
  const signingInput = `v1.${base64url(JSON.stringify(claims))}`
  const signature = createHmac('sha256', secret).update(signingInput).digest()

  return `${signingInput}.${base64url(signature)}`
}

export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile(path.join(import.meta.dirname, '.env.e2e.local'))
  } catch {
    // Values may come from real environment variables instead.
  }

  const secret = process.env.SESSION_SECRET
  const email = process.env.E2E_TEST_EMAIL

  if (!secret || secret.length < 32 || !email) {
    throw new Error(
      'e2e auth setup requires SESSION_SECRET (at least 32 characters) and '
      + 'E2E_TEST_EMAIL. Set them in frontend/e2e/.env.e2e.local or as real '
      + 'environment variables.',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const userId = '00000000-0000-0000-0000-0000000000e2'
  const oneDaySeconds = 60 * 60 * 24

  const token = issueSessionToken(
    { sub: userId, email, name: 'E2E', iat: now, exp: now + oneDaySeconds },
    secret,
  )

  const session = {
    token,
    expiresAt: new Date((now + oneDaySeconds) * 1000).toISOString(),
    user: { id: userId, email, displayName: 'E2E' },
  }

  const frontendPort = process.env.E2E_FRONTEND_PORT ?? '4173'
  const frontendOrigin = `http://127.0.0.1:${frontendPort}`

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: frontendOrigin,
        localStorage: [{ name: 'finance.session.v1', value: JSON.stringify(session) }],
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
