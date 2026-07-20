# Deployment

## Environment variables

### Backend (`backend/.env` locally; Render dashboard in production)

See `backend/.env.example` for a filled-in template.

| Variable | Required in production? | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | local SQLite (`backend/data/finance.db`) | Postgres in production |
| `SUPABASE_URL` | Yes | — | Also derives the JWKS URL and JWT issuer; see `docs/auth-options.md` |
| `SUPABASE_JWKS_URL` | No | derived from `SUPABASE_URL` | Only set to override the derivation |
| `SUPABASE_JWT_SECRET` | No | — | Only needed for Supabase projects still issuing HS256 (legacy) JWTs |
| `SUPABASE_SERVICE_ROLE_KEY` | Only if account deletion is used | — | Backend only, never exposed to the frontend |
| `ALLOWED_USER_EMAILS` | Yes | — | Comma-separated; empty/unset means anyone can sign in |
| `ADMIN_USER_EMAILS` | Yes | — | Comma-separated; controls privileged market-data mutations |
| `CORS_ORIGINS` | Yes (must not contain `*`) | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated |
| `APP_ENV` | — | `development` | `production` enables `validate_production_config()` |
| `LOCAL_NETWORK_ONLY` | Must be `false` | `false` | |
| `API_DOCS_ENABLED` | — | enabled outside production, disabled in production | See policy below |
| `MARKET_DATA_TIMEOUT_SECONDS` | No | `15` | |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` | No | `10` | |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | `30000` | |
| `RENDER_GIT_COMMIT` | No | — | Set automatically by Render; used for the `version` field of `GET /api/health` |

`validate_production_config()` (`app/config.py`) raises at startup if
`APP_ENV=production` and any of `DATABASE_URL`, `SUPABASE_URL`,
`ALLOWED_USER_EMAILS`, `ADMIN_USER_EMAILS` are missing, `CORS_ORIGINS`
contains `*`, or `LOCAL_NETWORK_ONLY` is true — this is the reproducible
check that production misconfiguration fails loudly instead of silently.

### Frontend (`frontend/.env.local` locally; Vercel dashboard in production)

See `frontend/.env.example` for a filled-in template.

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | |
| `VITE_SUPABASE_URL` | — | |
| `VITE_SUPABASE_ANON_KEY` | — | Public anon/publishable key, never a service-role key |
| `VITE_SUPABASE_AUTH_ENABLED` | disabled unless exactly `"true"` | Only controls whether the login screen shows — see `docs/auth-options.md`, it does **not** give you a working backend-auth-free local mode |
| `VITE_PRIVACY_CONTACT_EMAIL` | `"the deployment owner"` | Shown on Settings → Privacy |

## Local setup

1. **Backend**: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`, then copy `.env.example` to `.env` and fill in Supabase values (see `docs/auth-options.md` for why these are required even locally). Run migrations: `alembic upgrade head` (or let `initialise_database()` handle it on startup for SQLite). Start: `uvicorn app.main:app --reload`.
2. **Frontend**: `cd frontend && npm install`, copy `.env.example` to `.env.local` and fill in matching values, `npm run dev`.
3. **Verify**: `curl http://localhost:8000/api/health` should return `{"status": "ok", "version": "..."}`; the frontend at `http://localhost:5173` should reach a real sign-in screen if `VITE_SUPABASE_AUTH_ENABLED=true`.

## Production setup

Current production topology: Vercel (frontend), Render (backend), Supabase
(Postgres + Auth) — see the root `README.md`'s Stack section.

1. Backend environment variables are set in the Render dashboard, matching
   `render.yaml`'s `envVars` keys (`sync: false` entries need manual values;
   the rest have `render.yaml` defaults).
2. Frontend environment variables are set in the Vercel dashboard, per
   environment (Production/Preview).
3. Both are covered by `docs/oauth-and-hosting-checklist.md` for the
   dashboard-only configuration (OAuth redirect URIs, notification
   settings) that can't be verified from this repository.
4. Deploys: frontend auto-deploys on push to `main`; backend requires a
   manual trigger in the Render dashboard (`autoDeployTrigger: off`) — see
   `docs/release-and-rollback.md` for why and how rollback works.

## Production API documentation policy

FastAPI documentation exposure is controlled by `API_DOCS_ENABLED`.

The application uses these defaults:

- documentation is enabled outside production;
- documentation is disabled when `APP_ENV=production`;
- an explicit `API_DOCS_ENABLED=true` enables documentation in any environment;
- an explicit false value disables documentation in any environment.

When documentation is disabled, the following endpoints are not registered:

- `/docs`
- `/docs/oauth2-redirect`
- `/redoc`
- `/openapi.json`

The Render production service sets `API_DOCS_ENABLED=false` explicitly. Public
production deployments must keep this setting disabled unless API documentation
exposure has been deliberately reviewed and approved.

Local development requires no additional configuration because documentation is
enabled by default. Set `API_DOCS_ENABLED=false` locally to test the disabled
behavior.

## Account deletion configuration

Production account deletion requires `SUPABASE_SERVICE_ROLE_KEY` on the backend
service. This secret authorizes the backend to remove the authenticated user's
Supabase Auth identity after the user's application data has been deleted.

Requirements:

- configure the service-role key only on Render or another trusted backend;
- never expose it through a `VITE_` variable or frontend bundle;
- never commit it to the repository or include it in logs;
- rotate it immediately if it is exposed;
- verify the Settings account-deletion flow after changing Supabase projects.

If the variable is absent, the deletion endpoint returns a controlled
configuration error and does not claim that the account identity was removed.

Set `VITE_PRIVACY_CONTACT_EMAIL` in the Vercel frontend environment to the
monitored address that handles privacy requests. This value is public and must
not contain credentials or private operational information.
