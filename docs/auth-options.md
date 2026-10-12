# Authentication

Sign-in is chosen by `AUTH_MODE` on the backend and `VITE_AUTH_MODE` in the frontend build.

| | `google` (production, home server) | `supabase` (legacy, kept for local use) |
|---|---|---|
| Sign-in | Google Identity Services in the browser | Supabase Auth with Google |
| After sign-in | the API verifies Google's ID token **once** (`POST /api/auth/google`) and issues its own signed session token | the Supabase JWT is verified on every request |
| Every later request | `Authorization: Bearer <session token>`, verified with `SESSION_SECRET` (HMAC-SHA256); no third party involved | verified against Supabase's JWKS or `SUPABASE_JWT_SECRET` |
| Where the code is | `app/auth/google_session.py`, `app/routers/auth_session.py`, `frontend/src/auth/GoogleAuthProvider.tsx` | `app/auth/current_user.py`, `frontend/src/auth/AuthProvider.tsx` |

`get_current_user` always requires a valid bearer token: there is no bypass mode. For local development in
`google` mode you mint a token yourself ([deployment.md](deployment.md#local-development)).

## Session tokens

`v1.<payload>.<signature>`: the payload carries the user id, email, name and expiry; the signature is
HMAC-SHA256 over it with `SESSION_SECRET` (at least 32 characters). Tokens last `SESSION_TTL_HOURS`
(default 30 days). Changing `SESSION_SECRET` signs everyone out. The browser keeps the token in
`localStorage` under `finance.session.v1`; the API clearing a rejected token sends the person back to the
sign-in screen.

## Authorization

- **`ALLOWED_USER_EMAILS`**: the invite list. Any verified Google account can sign in, but an email that is
  neither allowed nor approved is rejected with `403`; the access-status screen tells a new person they are
  pending, and an admin can approve them (pending sign-up approval).
- **`ADMIN_USER_EMAILS`**: may maintain shared market data. Being allowed to sign in does not make someone an admin.

Both are required in production (`validate_production_config()`).

## Ownership

A row's owner is the user id from the verified session, never anything the browser sends: see
[multi-user-data-model.md](multi-user-data-model.md). `AUTH_USER_ID_MAP` (`email=user-id,...`) pins an email to
the id its existing rows carry (the former Supabase user id); an email without an entry gets `google:<sub>` and
starts empty.

## Legacy Supabase mode

Left in place for local use. It verifies Supabase JWTs by `alg`: HS256 against `SUPABASE_JWT_SECRET`, anything
else against the JWKS derived from `SUPABASE_URL`, and checks issuer and audience. It needs a real Supabase
project; there is no backend bypass.
