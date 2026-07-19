# F - Transactions

A personal finance web app for storing, importing, cleaning, categorising, and
analysing financial data on Mac and iPhone: transactions, money owed, investments,
and net wealth, with bank/broker CSV import and Supabase-backed sync.

Current release status, the readiness scorecard, and verification evidence live in
[`docs/production-roadmap.md`](docs/production-roadmap.md). Remaining work is
tracked in [`TODO_LIST.md`](TODO_LIST.md) and in the repository's GitHub issues.

## Stack

### Frontend

- React 19, TypeScript, Vite
- Minimal custom CSS
- Hosted on Vercel
- Supabase JavaScript client
- Google OAuth through Supabase Auth
- API access isolated in frontend API modules

### Backend

- FastAPI, SQLAlchemy, Pydantic, Alembic
- Hosted on Render
- Repository and service layers
- Supabase JWT verification through JWKS or legacy secret
- Email allowlist
- Application-level user isolation

### Database

- SQLite for local development
- Supabase Postgres for production
- Alembic migrations in production
- Legacy SQLite startup migrations remain active for local databases
- No database Row Level Security policies; ownership is enforced at the application layer
- Relational foreign keys and deliberate delete behavior protect linked financial records

### Authentication

- Supabase Auth with Google OAuth
- Bearer tokens sent from frontend to backend
- JWT signature, expiration, audience, and issuer validation
- Email-based allowlist
- Application owner ID derived from the validated Supabase `sub`

### Deployment

- Vercel Hobby (frontend), Render free tier (backend), Supabase free project
- Render pre-deploy Alembic migration, manual Render deployment
- GitHub Actions keep-warm workflow
- Required GitHub Actions CI covering backend tests, database/recovery checks,
  frontend lint and build, dependency audits, and repository hygiene

### Build versioning

Every build embeds a short commit identifier, so a deployed build can always
be identified unambiguously:

- **Frontend**: `frontend/vite.config.ts` reads `VERCEL_GIT_COMMIT_SHA`
  (Vercel) or `RENDER_GIT_COMMIT` (if ever built there), falling back to
  running `git rev-parse --short HEAD` locally. It's embedded at build time
  and shown in **Settings → Build** in the app.
- **Backend**: `app/services/health_service.py` reads `RENDER_GIT_COMMIT`
  (set automatically by Render at both build and runtime), falling back to
  `git rev-parse --short HEAD`. It's returned in the `version` field of
  `GET /api/health`.

Release notes live in [`CHANGELOG.md`](CHANGELOG.md) — add an entry there in
the same PR as any user-facing change.

## Free-tier viability

**Viable today for:** personal use, a small invited group, low request volume,
small database size, non-critical availability, manual operational oversight,
occasional cold starts.

**Not yet viable for:** reliable low-latency access, strong uptime expectations,
large or unpredictable traffic, business-critical financial access, guaranteed
recovery objectives, high-volume file imports, publicly advertised availability.

See [`docs/production-roadmap.md`](docs/production-roadmap.md) for the full
free-tier fix list, likely paid-tier triggers, and the readiness scorecard.

## Build versioning

There are no semantic version numbers; deployments are identified by short
git commit hashes instead.

- **Frontend**: `vite.config.ts` embeds the commit (from `VERCEL_GIT_COMMIT_SHA`,
  falling back to `RENDER_GIT_COMMIT`, falling back to running `git rev-parse
  --short HEAD` locally) and the build timestamp into the bundle at build
  time. Visible in **Settings → Build** in the app.
- **Backend**: `app/services/health_service.py` reads `RENDER_GIT_COMMIT` at
  runtime, falling back to `git rev-parse --short HEAD`. Exposed in the
  `version` field of `GET /api/health`.
- Both approaches work the same way locally, in Vercel/Render previews, and
  in production — only the source of the commit hash changes.

See [`CHANGELOG.md`](CHANGELOG.md) for release notes and how to maintain them.

## Documentation

- [`docs/production-roadmap.md`](docs/production-roadmap.md) — readiness scorecard, verification evidence, release-readiness definition, upgrade triggers, resolved product decisions
- [`docs/deployment.md`](docs/deployment.md) — deployment and API documentation policy
- [`docs/backups-supabase.md`](docs/backups-supabase.md) — backup and recovery
- [`docs/privacy.md`](docs/privacy.md) — privacy and account deletion
- [`docs/internationalization.md`](docs/internationalization.md) — locale, currency, and translation support
- [`docs/security-and-timeouts.md`](docs/security-and-timeouts.md) — request/database timeouts and security hardening
- [`docs/browser-support.md`](docs/browser-support.md) — supported browser matrix and how it's verified in CI
- [`docs/pwa-offline.md`](docs/pwa-offline.md) — offline support decision and how the service worker works
- [`docs/incident-response.md`](docs/incident-response.md) — detection, triage, communication, and recovery for production incidents
- [`docs/release-and-rollback.md`](docs/release-and-rollback.md) — how releases and rollbacks actually work on Render and Vercel
- [`docs/production-operations-checklist.md`](docs/production-operations-checklist.md) — dashboard-only items (OAuth, notifications, Supabase capacity) that can't be verified from this repo
- [`CHANGELOG.md`](CHANGELOG.md) — release notes
- [`frontend/README.md`](frontend/README.md) — frontend-specific notes
- [`TODO_LIST.md`](TODO_LIST.md) — open, actionable tasks only
