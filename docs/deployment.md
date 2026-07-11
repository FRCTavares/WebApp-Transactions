# Deployment notes

This app is local-first in development, but the current production setup uses:

- Backend: Render
- Database: Supabase/Postgres
- Frontend: Vercel
- Auth: Supabase Google Auth

Do not commit secrets. Configure production values only in Render, Vercel, and Supabase dashboards.

## Render backend

Expected settings:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Pre-deploy command: `alembic upgrade head`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/health`

Required Render environment variables:

- `APP_ENV=production`
- `DATABASE_URL`
- `SUPABASE_URL`
- `ALLOWED_USER_EMAILS`
- `ADMIN_USER_EMAILS`
- `CORS_ORIGINS`

Production examples:

- `SUPABASE_URL=https://your-project-ref.supabase.co`
- `ALLOWED_USER_EMAILS=you@example.com`
- `ADMIN_USER_EMAILS=you@example.com`
- `CORS_ORIGINS=https://your-vercel-app.vercel.app`

`LOCAL_NETWORK_ONLY` must be false on Render.

`APP_ACCESS_TOKEN` is legacy/local-only fallback auth. It is skipped when Supabase auth is enabled and should not be treated as the production auth mechanism.

`ADMIN_USER_EMAILS` controls privileged shared-data mutations. Authenticated
allowed users may read market prices, but only configured admin emails may fetch,
create, update, or delete shared market-price records. Every admin email should
also be present in `ALLOWED_USER_EMAILS`.


## Production safety guard

When `APP_ENV=production`, the backend fails startup if:

- `DATABASE_URL` is missing.
- `SUPABASE_URL` is missing.
- `ALLOWED_USER_EMAILS` is empty.
- `ADMIN_USER_EMAILS` is empty.
- `CORS_ORIGINS` contains `*`.
- `LOCAL_NETWORK_ONLY=true`.

This prevents accidentally deploying an open or misconfigured finance API.

## Supabase/Postgres

For non-SQLite databases, the FastAPI app does not run `create_all` on startup.

Schema creation must happen through Alembic:

`alembic upgrade head`

On Render this is configured as the pre-deploy command.

Supabase Auth must have Google provider enabled. The Vercel production URL and local development URL should be allowed redirect URLs.

## Vercel frontend

Required Vercel environment variables:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Production examples:

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com`
- `VITE_SUPABASE_URL=https://your-project-ref.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key`

Only public Supabase keys belong in the frontend. Never put the service-role key, database password, Google client secret, or JWT secret in Vercel frontend variables.


## Security headers

The backend adds basic security headers to every response:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Auth debugging

Use:

- `GET /api/health` to confirm the backend is alive.
- `GET /api/me` to confirm the backend accepts the current authenticated user.

Expected `/api/me` response:

`{"user_id":"you@example.com","email":"you@example.com"}`


## Production smoke test

Run from the repo root:

`API_BASE_URL=https://f-transactions-api.onrender.com ORIGIN=https://web-app-transactions.vercel.app ./scripts/smoke_production.sh`

This checks:

- `/api/health`
- `/api/me` without a token returns `401`
- CORS preflight from the frontend origin



## Data integrity audit

See `docs/data-integrity.md`.

Before adding stricter database constraints, run:

`python scripts/audit_data_integrity.py`

The script is read-only and reports violation counts without printing personal transaction rows.

## Backup and export

See `docs/backups-supabase.md`.

The backend exposes:

- `GET /api/export/json`

This returns only the authenticated user's app data. Use it as a simple personal export path, not as the only database backup strategy.

## Before wider family/friends use

Still required before wider sharing:

1. Decide whether each person gets isolated data or shared family data.
2. Add account onboarding and clear user management.
3. Confirm backup/export strategy for Supabase data.
4. Keep production CORS restricted to the final frontend domains.
5. Add basic operational checks for failed imports and auth failures.
