# Incident Response

This defines how incidents are detected, triaged, and resolved for
F - Transactions. For data-loss/corruption recovery specifically, see
[`docs/backups-supabase.md`](backups-supabase.md) — this document covers the
broader incident process (outages, bad deploys, auth breakage, etc.).

This is a personal/small-group project with a single owner, so "ownership"
and "communication" below are intentionally lightweight — the goal is a
clear, repeatable process the owner can follow under stress, not a
multi-person on-call rotation.

## Ownership

The application owner (repository owner) is the sole incident responder.
There is no on-call rotation or external support contract.

## Detection

- **Automated (keep-warm + monitoring)**: two separate mechanisms, found to
  need splitting apart 2026-07-20 during the `docs/oauth-and-hosting-checklist.md`
  walkthrough, after discovering GitHub Actions silently throttles frequent
  cron schedules (runs every ~hour in practice, not every 10 minutes as
  originally written/intended, even though nothing was failing):
  - **cron-job.org** (external, free) hits `GET /api/health` every 10
    minutes on a real, reliable schedule — this is what actually reduces
    Render cold starts now.
  - `.github/workflows/keep-backend-warm.yml` runs on its own (throttled,
    roughly hourly) GitHub Actions schedule and checks `GET /api/health`,
    `GET /api/ready`, and frontend availability, failing the workflow (via
    `curl --fail`) on any non-2xx response or timeout. A failed *scheduled*
    GitHub Actions workflow run triggers GitHub's default email
    notification to repository watchers — this remains the primary
    automated alert/incident-detection path, just at an hourly rather than
    10-minute resolution. There's no separate paging service; see
    `docs/production-roadmap.md` for the free-tier constraints this
    accepts.
- **Manual**: the owner notices broken behavior while using the app, or a
  user reports it directly.

## Severity levels

| Level | Definition | Example |
|---|---|---|
| SEV1 | Data loss/corruption, or the app is completely unusable for all users | Database restore needed; auth completely broken |
| SEV2 | A core workflow is broken but the app is otherwise usable | Import/export failing; a page crashes |
| SEV3 | Degraded but workable | Slow responses; a non-critical page has a bug |

## Triage

1. Confirm the failure is real (check `GET /api/health` and `GET /api/ready`
   directly, not just the automated alert).
2. Classify severity (above).
3. Check the Render and Vercel dashboards' deploy/build logs for the most
   recent deploy — most incidents immediately follow a deploy.
4. Decide the fix path:
   - **Bad deploy** → see [`docs/release-and-rollback.md`](release-and-rollback.md).
   - **Data loss/corruption** → see [`docs/backups-supabase.md`](backups-supabase.md).
   - **Third-party outage** (Supabase, Render, Vercel, Google OAuth) → check
     the provider's status page; there is usually nothing to do but wait and
     communicate the outage (see below).
   - **Auth/OAuth breakage** → check Google Cloud Console OAuth client
     configuration and Supabase Auth settings first (see the OAuth
     checklist in `docs/oauth-and-hosting-checklist.md`); these are the
     most common source of "everyone is logged out" incidents.

## Communication

Given the current scale (personal/small invited group), there's no status
page or external communication channel. If other people are actively
affected:

- Tell them directly (message/email) what's broken and the expected
  timeframe, using the severity table above to set expectations.
- Once resolved, confirm resolution the same way.

Revisit this if the user base grows beyond a small invited group — see
`docs/production-roadmap.md`'s "Global release readiness" criteria.

## Recovery

- **Bad deploy**: follow [`docs/release-and-rollback.md`](release-and-rollback.md).
- **Data issue**: follow the recovery sequence in
  [`docs/backups-supabase.md`](backups-supabase.md#recovery-sequence).
- **Migration failure**: `render.yaml`'s `preDeployCommand` runs `alembic
  upgrade head`. Render's documented behavior is that if any pre-deploy
  command fails, the entire deploy is aborted and the previous instance
  keeps running with zero downtime — so a broken migration should never
  actually reach production traffic. `backend/tests/test_migration_failure_blocks_deploy.py`
  verifies the half of this we control: a broken migration causes `alembic
  upgrade head` to exit non-zero.

## Post-incident

For any SEV1 or SEV2 incident, write a short note (can be a GitHub issue)
covering: what happened, when it was detected, what fixed it, and one
concrete follow-up to reduce the chance of recurrence. Link it from
`CHANGELOG.md` if it resulted in a code change.
