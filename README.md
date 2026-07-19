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

## Free-tier viability

**Viable today for:** personal use, a small invited group, low request volume,
small database size, non-critical availability, manual operational oversight,
occasional cold starts.

**Not yet viable for:** reliable low-latency access, strong uptime expectations,
large or unpredictable traffic, business-critical financial access, guaranteed
recovery objectives, high-volume file imports, publicly advertised availability.

See [`docs/production-roadmap.md`](docs/production-roadmap.md) for the full
free-tier fix list, likely paid-tier triggers, and the readiness scorecard.

## Documentation

- [`docs/production-roadmap.md`](docs/production-roadmap.md) — readiness scorecard, verification evidence, release-readiness definition, upgrade triggers, resolved product decisions
- [`docs/deployment.md`](docs/deployment.md) — deployment and API documentation policy
- [`docs/backups-supabase.md`](docs/backups-supabase.md) — backup and recovery
- [`docs/privacy.md`](docs/privacy.md) — privacy and account deletion
- [`docs/internationalization.md`](docs/internationalization.md) — locale, currency, and translation support
- [`docs/security-and-timeouts.md`](docs/security-and-timeouts.md) — request/database timeouts and security hardening
- [`docs/browser-support.md`](docs/browser-support.md) — supported browser matrix and how it's verified in CI
- [`docs/pwa-offline.md`](docs/pwa-offline.md) — offline support decision and how the service worker works
- [`frontend/README.md`](frontend/README.md) — frontend-specific notes
- [`TODO_LIST.md`](TODO_LIST.md) — open, actionable tasks only
