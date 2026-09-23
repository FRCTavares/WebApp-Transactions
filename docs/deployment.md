# Deployment

## Environment variables

### Backend (`backend/.env` locally; Google Cloud Run in production)

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
| `APP_GIT_COMMIT` | No | — | Release commit supplied explicitly during Cloud Run deployment; exposed as the short `version` in `GET /api/health` |
| `RENDER_GIT_COMMIT` | No | — | Legacy compatibility fallback only; do not set for new Cloud Run releases |

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

Current production topology: Vercel (frontend), Google Cloud Run (backend),
and Supabase (Postgres + Auth).

The live backend service is `webapp-transactions-backend` in `europe-west1`.
It is deployed from `./backend` with Google Cloud source deployment/buildpacks;
`backend/Procfile` defines the Uvicorn web process. The production database
schema is managed by the separate `f-transactions-migrate` Cloud Run Job.

For a backend release:

1. Confirm CI is green and the intended release commit is checked out.
2. If `backend/migrations/` changed, rebuild `f-transactions-migrate` from the
   same release `./backend` source, preserving its `DATABASE_URL` Secret Manager
   reference, `alembic upgrade head` command, and `maxRetries=0`.
3. Execute `gcloud run jobs execute f-transactions-migrate
   --region=europe-west1 --wait`. Do not deploy the service unless it succeeds.
4. Confirm the production `alembic_version` matches the repository Alembic
   head.
5. Capture the release commit and manually deploy
   `webapp-transactions-backend` from `./backend` to `europe-west1`. Preserve
   the existing secrets and service configuration while updating the build
   identifier with `APP_GIT_COMMIT`.
6. Run `scripts/smoke_production.sh`, confirm `/api/ready`, confirm
   `/api/health` reports the expected short release commit, and inspect Cloud
   Run logs.
7. Frontend environment variables remain managed in Vercel per environment.

Cloud Run has no Render-style automatic `preDeployCommand`; the migration Job
is therefore an explicit human-controlled release gate, not an implicit
platform guarantee. See `docs/release-and-rollback.md` for the full order and
rollback procedure.

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

The Cloud Run production service sets `API_DOCS_ENABLED=false` explicitly. Public
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

- configure the service-role key only on Cloud Run or another trusted backend;
- never expose it through a `VITE_` variable or frontend bundle;
- never commit it to the repository or include it in logs;
- rotate it immediately if it is exposed;
- verify the Settings account-deletion flow after changing Supabase projects.

If the variable is absent, the deletion endpoint returns a controlled
configuration error and does not claim that the account identity was removed.

Set `VITE_PRIVACY_CONTACT_EMAIL` in the Vercel frontend environment to the
monitored address that handles privacy requests. This value is public and must
not contain credentials or private operational information.
