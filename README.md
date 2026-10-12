# Vault

Vault is the name you see in the app. Its hostname (`finance.<tailnet>.ts.net`), compose project and database are still called `finance`.

A personal finance web app for storing, importing, cleaning, categorising, and
analysing financial data on Mac and iPhone: transactions, money owed, investments,
and net wealth, with bank/broker CSV import.

Current release status, the readiness scorecard, and verification evidence live in
[`docs/production-roadmap.md`](docs/production-roadmap.md). Remaining work is
tracked in [`TODO_LIST.md`](TODO_LIST.md) and in the repository's GitHub issues.

## Stack

Self-hosted on the home server, reachable only over Tailscale
(`https://finance.<tailnet>.ts.net`); see [`docs/self-hosted.md`](docs/self-hosted.md).
The former Vercel / Google Cloud Run / Supabase deployment was decommissioned on
2026-10-11.

- **Frontend**: React 19, TypeScript, Vite, minimal custom CSS, served by Caddy.
- **Backend**: FastAPI, SQLAlchemy, Pydantic, Alembic; repository and service
  layers; application-level user isolation (no database RLS).
- **Database**: PostgreSQL 17 on the server; SQLite for local development;
  Alembic migrations run by a one-shot job before each release. Backups are
  taken by the HomeServer backup job and restore-tested.
- **Authentication**: Google sign-in verified once by the API, which issues its
  own signed session, plus an email allowlist and a pending sign-up approval
  flow.
- **Releases**: manual. `deploy/package-release.sh`, then `deploy-finance` on the
  server. Merging to `main` deploys nothing.

## Who it is for

**Fine for:** personal use and a small invited group on the owner's own server, at no recurring cost.

**Not for:** use without Tailscale, strong uptime expectations, large or unpredictable traffic, business-critical
financial access, or a public release (market data comes from unofficial Yahoo endpoints).

See [`docs/production-roadmap.md`](docs/production-roadmap.md) for the status, constraints and decisions.

## Build versioning

There are no semantic version numbers; deployments are identified by short
git commit hashes instead.

- **Frontend**: `vite.config.ts` embeds `APP_GIT_COMMIT` when supplied (the
  release build does), otherwise local `git rev-parse --short HEAD`; the build
  timestamp is embedded alongside it.
  Both are visible in **Settings → Build**.
- **Backend**: `app/services/health_service.py` reads `APP_GIT_COMMIT` (set by the
  server build) and finally tries local git metadata, so `GET /api/health`
  identifies the release.

See [`CHANGELOG.md`](CHANGELOG.md) for release notes and how to maintain them.

## Documentation

Full index: [`docs/README.md`](docs/README.md).

- [`docs/production-roadmap.md`](docs/production-roadmap.md) — status, accepted constraints, resolved product decisions
- [`docs/deployment.md`](docs/deployment.md) — environment variables and local development setup
- [`docs/auth-options.md`](docs/auth-options.md) — Google sign-in, the API's own session, allowlist/admin
- [`docs/multi-user-data-model.md`](docs/multi-user-data-model.md) — ownership, ownership enforcement, shared vs. per-user data
- [`docs/backups.md`](docs/backups.md) — backup and recovery
- [`docs/privacy.md`](docs/privacy.md) — privacy and account deletion
- [`docs/internationalization.md`](docs/internationalization.md) — locale, currency, and translation support
- [`docs/security-and-timeouts.md`](docs/security-and-timeouts.md) — request/database timeouts and security hardening
- [`docs/browser-support.md`](docs/browser-support.md) — supported browser matrix and how it's verified
- [`docs/pwa-offline.md`](docs/pwa-offline.md) — offline support decision and how the service worker works
- [`docs/incident-response.md`](docs/incident-response.md) — detection, triage, communication, and recovery steps
- [`docs/release-and-rollback.md`](docs/release-and-rollback.md) — how releases happen and how to roll one back
- [`docs/oauth-and-hosting-checklist.md`](docs/oauth-and-hosting-checklist.md) — Google OAuth client and server checks
- [`CHANGELOG.md`](CHANGELOG.md) — release notes
- [`frontend/README.md`](frontend/README.md) — frontend-specific setup, commands, and project structure
- [`TODO_LIST.md`](TODO_LIST.md) — open, actionable tasks only
