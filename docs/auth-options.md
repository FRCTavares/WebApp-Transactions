# Authentication Options

## The two states

Authentication is controlled by one frontend flag and mirrored backend
configuration:

| | `VITE_SUPABASE_AUTH_ENABLED=true` | unset / anything else |
|---|---|---|
| Frontend | Shows Google sign-in via Supabase Auth | Skips straight to the app UI, no login screen |
| Backend | Verifies a real Supabase JWT on every request | Still verifies a real Supabase JWT on every request |

**These are not independent local vs. hosted modes.** The backend's
`get_current_user` dependency (`app/auth/current_user.py`) unconditionally
requires a valid `Authorization: Bearer <token>` header and decodes it as a
real Supabase JWT — there is no backend-side bypass. A previous local-auth
bypass was removed (see the `LOCAL_DEFAULT_USER_ID` constant in
`current_user.py`, which is now dead code left over from that removal).

**Practical consequence**: setting `VITE_SUPABASE_AUTH_ENABLED` to anything
other than `true` only hides the login screen. It does not give you a
working local mode — every page that fetches data will get `401`s, because
no request carries a token. To actually use the app, including locally,
the backend needs a real Supabase project configured
(`SUPABASE_URL` + either `SUPABASE_JWKS_URL` or `SUPABASE_JWT_SECRET`), and
the frontend needs `VITE_SUPABASE_AUTH_ENABLED=true` with matching
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

The one working exception: `frontend/e2e/global-setup.ts` mints a real
Supabase-shaped JWT locally (HS256, signed with the same
`SUPABASE_JWT_SECRET` the backend is configured with) and injects it
directly into `localStorage`, bypassing the Google OAuth flow but still
producing a token the backend genuinely verifies. This is how the
Playwright e2e suite runs without a browser-based OAuth flow. See
`frontend/e2e/.env.e2e.local` (gitignored) for the secrets this needs.

## Verification: HS256 legacy secret vs. JWKS

`decode_supabase_jwt` (`app/auth/current_user.py`) branches on the JWT's
`alg` header:

- **`HS256`** → verified against `SUPABASE_JWT_SECRET` (the older,
  shared-secret Supabase Auth signing method).
- **Anything else** (Supabase's current default, asymmetric signing) →
  verified against `SUPABASE_JWKS_URL`, fetched from Supabase's JWKS
  endpoint. If `SUPABASE_JWKS_URL` isn't set explicitly, it's derived
  automatically from `SUPABASE_URL`
  (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`).

In both cases, the token's issuer is also checked against
`<SUPABASE_URL>/auth/v1` and the audience against `"authenticated"`.

For a current Supabase project, you generally only need `SUPABASE_URL` —
JWKS derivation handles the rest. `SUPABASE_JWT_SECRET` only matters for
projects still issuing HS256 tokens.

## Authorization: allowlist and admin emails

Authentication (who you are) is separate from authorization (what you can
do):

- **`ALLOWED_USER_EMAILS`**: comma-separated list. If set, only these
  emails can authenticate at all (`is_allowed_user_email` returns `403`
  otherwise). If unset, any authenticated Supabase user is allowed — see
  the resolved "open registration" decision in `docs/production-roadmap.md`.
- **`ADMIN_USER_EMAILS`**: comma-separated list. Controls
  `get_privileged_user`, used for admin-only mutation endpoints (shared
  market data management). Separate from `ALLOWED_USER_EMAILS` — being
  allowed to sign in doesn't imply admin access.

Both are required (non-empty) when `APP_ENV=production`, enforced by
`validate_production_config()` at startup.

## Ownership

The authenticated user's identity for data-ownership purposes is the
Supabase JWT's `sub` claim, never anything the frontend sends directly —
see `docs/multi-user-data-model.md` for how that's used across the schema.
