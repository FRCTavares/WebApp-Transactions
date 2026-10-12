# Documentation Index

Start at the root [`README.md`](../README.md) for the project overview,
stack, and build versioning. This folder holds the detailed docs it links to.

## Architecture and data model

- [`multi-user-data-model.md`](multi-user-data-model.md) — ownership, ownership enforcement, shared vs. per-user data
- [`auth-options.md`](auth-options.md) — Google sign-in and the API's own session, allowlist/admin

## Setup and operations

- [`self-hosted.md`](self-hosted.md) — running on the home server (Google sign-in, Caddy, Postgres, releases)
- [`deployment.md`](deployment.md) — environment variable reference and local development setup
- [`backups.md`](backups.md) — what the HomeServer backs up, retention, and how to recover
- [`incident-response.md`](incident-response.md) — detection, triage, communication
- [`release-and-rollback.md`](release-and-rollback.md) — how releases happen, how to roll one back
- [`oauth-and-hosting-checklist.md`](oauth-and-hosting-checklist.md) — Google OAuth client and server checks, common sign-in failures

## Product and quality

- [`production-roadmap.md`](production-roadmap.md) — status, accepted constraints, resolved decisions
- [`privacy.md`](privacy.md) — privacy and account deletion
- [`internationalization.md`](internationalization.md) — locale, currency, translation
- [`security-and-timeouts.md`](security-and-timeouts.md) — request/database timeouts, security hardening
- [`browser-support.md`](browser-support.md) — supported browser matrix, how it's verified
- [`pwa-offline.md`](pwa-offline.md) — offline support decision and implementation

Open, actionable work lives in [`../TODO_LIST.md`](../TODO_LIST.md), not here.
Release notes live in [`../CHANGELOG.md`](../CHANGELOG.md).
