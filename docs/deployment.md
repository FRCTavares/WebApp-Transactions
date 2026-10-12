# Configuration and Local Setup

Production is the home server: see [self-hosted.md](self-hosted.md) for the topology and
[release-and-rollback.md](release-and-rollback.md) for releases. This page is the environment reference and the
local development setup.

## Backend environment

Production values live in `/etc/homeserver/secrets/apps/finance.env` on the server (template:
`backend/.env.selfhosted.example`). Local development uses `backend/.env` (template: `backend/.env.example`).

| Variable | Production | Notes |
|---|---|---|
| `APP_ENV` | `production` | turns on `validate_production_config()`, which refuses to start on a bad configuration |
| `DATABASE_URL` | required | PostgreSQL in production; local SQLite (`backend/data/finance.db`) when unset |
| `AUTH_MODE` | `google` | `supabase` is the legacy mode, kept for local use (see [auth-options.md](auth-options.md)) |
| `GOOGLE_CLIENT_ID` | required for `google` | must end in `.apps.googleusercontent.com` |
| `SESSION_SECRET` | required for `google` | at least 32 characters; signs the API's own session tokens |
| `SESSION_TTL_HOURS` | optional | default 720 (30 days) |
| `AUTH_USER_ID_MAP` | optional | `email=user-id,...` pins an email to the id its rows already carry |
| `ALLOWED_USER_EMAILS` | required | comma-separated invite list |
| `ADMIN_USER_EMAILS` | required | may maintain shared market data |
| `CORS_ORIGINS` | required | must not contain `*`; the site origin |
| `LOCAL_NETWORK_ONLY` | `false` | must be false in production |
| `API_DOCS_ENABLED` | `false` | `/docs`, `/redoc` and `/openapi.json` are not registered when false (the default in production) |
| `APP_GIT_COMMIT` | set by the build | the short commit reported by `GET /api/health` |
| `DATABASE_CONNECT_TIMEOUT_SECONDS`, `DATABASE_STATEMENT_TIMEOUT_MS`, `MARKET_DATA_TIMEOUT_SECONDS` | optional | defaults 10 s, 30 000 ms, 15 s |

The `SUPABASE_*` variables only matter in `AUTH_MODE=supabase`.

## Frontend build variables

Baked into the bundle at image build time (`/etc/homeserver/config/apps/finance-build.env`), so changing the
hostname means rebuilding.

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | the site origin, no `/api` (e.g. `https://finance.<tailnet>.ts.net`) |
| `VITE_AUTH_MODE` | `google` for the server build |
| `VITE_GOOGLE_CLIENT_ID` | the public OAuth client id |
| `VITE_PRIVACY_CONTACT_EMAIL` | shown on the Privacy page and Settings |

## Local development

The simplest local setup needs no Google or Supabase account: run the API in `AUTH_MODE=google` against SQLite
and give the browser a session token you mint yourself.

1. **Backend** (`backend/`): `python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt`.
2. Start it with a throwaway database and secret:

   ```bash
   export DATABASE_URL=sqlite:////tmp/finance-demo.db AUTH_MODE=google \
     GOOGLE_CLIENT_ID=demo.apps.googleusercontent.com SESSION_SECRET=$(openssl rand -hex 32) \
     ALLOWED_USER_EMAILS=demo@example.com ADMIN_USER_EMAILS=demo@example.com CORS_ORIGINS=http://localhost:5174
   python -m alembic upgrade head
   uvicorn app.main:app --port 8001
   ```

3. **Session token**: `python -c "from app.auth.google_session import issue_session_token as t; print(t(user_id='demo-user', email='demo@example.com', name='Demo'))"`
   (same environment). In the browser console on the app's origin, store it under `finance.session.v1` as
   `{"token": "...", "expiresAt": "<ISO time>", "user": {"id": "demo-user", "email": "demo@example.com", "displayName": "Demo"}}`.
4. **Frontend** (`frontend/`): `npm install`, then
   `VITE_API_BASE_URL=http://localhost:8001 VITE_AUTH_MODE=google VITE_GOOGLE_CLIENT_ID=demo.apps.googleusercontent.com npx vite --port 5174`.
5. Seed data through the API (categories first, then transactions, owed items and wealth accounts) or import a CSV.

`GET http://localhost:8001/api/health` should return `{"status": "ok", ...}`.

## Account deletion

In `AUTH_MODE=google`, deleting an account removes the user's application data and signs the browser out; the
Google identity is not ours to delete. (In the legacy `supabase` mode it also needs `SUPABASE_SERVICE_ROLE_KEY`
on the backend, never in a `VITE_` variable.)
