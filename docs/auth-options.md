# Authentication

Sign-in is Google Identity Services in the browser, verified once by this app's own API, which then issues its own
session token. There is no other sign-in mode.

| Step | What happens | Where |
|---|---|---|
| Sign in | the browser gets a Google ID token and sends it once to `POST /api/auth/google` | `frontend/src/auth/GoogleAuthProvider.tsx`, `app/routers/auth_session.py` |
| Verify | the API checks Google's signature and audience (`GOOGLE_CLIENT_ID`) and that the email is verified, then answers with a session token | `app/auth/google_session.py` |
| Every later request | `Authorization: Bearer <session token>`, verified with `SESSION_SECRET` (HMAC-SHA256); no third party is involved | `app/auth/current_user.py` |

`get_current_user` always requires a valid bearer token: there is no bypass mode. For local development you mint a
token yourself ([deployment.md](deployment.md#local-development)).

## Session tokens

`v1.<payload>.<signature>`: the payload carries the user id, email, name and expiry; the signature is HMAC-SHA256
over it with `SESSION_SECRET` (at least 32 characters). Tokens last `SESSION_TTL_HOURS` (default 30 days). Changing
`SESSION_SECRET` signs everyone out. The browser keeps the token in `localStorage` under `finance.session.v1`; a
rejected token is cleared and the person goes back to the sign-in screen.

## Authorization

- **`ALLOWED_USER_EMAILS`**: the invite list. Any verified Google account can sign in, but an email that is neither
  allowed nor approved is rejected with `403`; the access-status screen tells a new person they are pending, and an
  admin can approve them (pending sign-up approval).
- **`ADMIN_USER_EMAILS`**: may maintain shared market data. Being allowed to sign in does not make someone an admin.

Both are required in production (`validate_production_config()`, which also requires `GOOGLE_CLIENT_ID` and a
`SESSION_SECRET` of at least 32 characters).

## Ownership

A row's owner is the user id from the verified session, never anything the browser sends: see
[multi-user-data-model.md](multi-user-data-model.md). `AUTH_USER_ID_MAP` (`email=user-id,...`) pins an email to the id
its existing rows carry (the user id from before the move to Google sign-in); an email without an entry gets
`google:<sub>` and starts empty.
