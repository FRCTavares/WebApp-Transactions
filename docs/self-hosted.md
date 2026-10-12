# Self-hosted deployment (HomeServer)

This is the app side of running F - Transactions on the home server with **no
Supabase, no Google Cloud and no Vercel**. The server side (Postgres, compose,
Tailscale, backups) lives in the HomeServer repository. This is how the app has
run since 2026-10-11. In the code the self-hosted behaviour is still switched by
`AUTH_MODE=google`; with it unset the app falls back to the legacy Supabase mode,
which is kept for local use.

## What is replaced

| Was | Now | Switch |
|---|---|---|
| Supabase Auth | Google Identity Services → `POST /api/auth/google` → an API-issued signed session | `AUTH_MODE=google` / `VITE_AUTH_MODE=google` |
| Supabase account deletion | Deleting an account removes its data; the Google identity is not ours to delete | `AUTH_MODE=google` |
| Supabase Postgres | Postgres 17 on the server | `DATABASE_URL` |
| Vercel | Caddy serves the build and proxies `/api` (`deploy/web`) | image build |
| Cloud Run + migrate job | `backend/Dockerfile`; the one-shot job runs `python -m alembic upgrade head` | image |

Google is still used for **one thing**: proving who is signing in. The API
verifies Google's ID token once and issues its own session; no later request
needs Google or any third party.

## Behaviour that does not change

- `ALLOWED_USER_EMAILS` and the pending sign-up approval flow work as before: any
  verified Google account can sign in, `get_current_user` still rejects an email
  that is neither allowed nor approved, and the access-status screen still tells
  a new person they are pending. `ADMIN_USER_EMAILS` still gates market-data
  maintenance.
- Rows are keyed by `user_id`. Today that is the Supabase `sub`, which the
  database dump does not tell the new sign-in about. **`AUTH_USER_ID_MAP`**
  (`email=user-id,email2=user-id2`) pins each email to the id its rows already
  carry; an email with no entry gets `google:<sub>` and starts empty.

## Environment contract

Backend: [`backend/.env.selfhosted.example`](../backend/.env.selfhosted.example).
With `APP_ENV=production` the app refuses to start when `AUTH_MODE=google` lacks a
`GOOGLE_CLIENT_ID` or a `SESSION_SECRET` of at least 32 characters.

Web image build args (`deploy/web/Dockerfile`): `VITE_API_BASE_URL` (the site
origin, e.g. `https://finance.<tailnet>.ts.net`, no `/api`) and
`VITE_GOOGLE_CLIENT_ID`. They are baked into the bundle, so changing the
hostname means rebuilding.

## One-time prerequisites (you)

1. **Google OAuth client.** Reuse the existing client and add the app's origin
   (`https://finance.<tailnet>.ts.net`) under *Authorized JavaScript origins*.
2. **Secrets**: `SESSION_SECRET` (`openssl rand -base64 48`) and the database
   password.
3. **User ids**: on the restored database, list who has data and put each pair
   in `AUTH_USER_ID_MAP`:

   ```sql
   SELECT user_id, count(*) FROM transactions GROUP BY 1 ORDER BY 2 DESC;
   ```

## Releases

`deploy/package-release.sh` packages the exact committed source
(`finance-g<sha>`); the HomeServer's `deploy-finance` builds the two images
(`backend/Dockerfile`, `deploy/web/Dockerfile`), runs the migrate job, then swaps
the containers. Take a fresh backup before any release that adds a migration. The
full steps and rollback are in [release-and-rollback.md](release-and-rollback.md).

## Not covered

- Supabase Auth accounts are not in the `public` dump: access is the invite list.
- Anything outside the tailnet cannot reach the app by design.
- There are no hosted scheduled jobs or CI: backups are the HomeServer's
  ([backups.md](backups.md)) and tests run locally ([release-and-rollback.md](release-and-rollback.md)).
