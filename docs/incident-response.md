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

- **Automated monitoring**:
  `.github/workflows/keep-backend-warm.yml` runs hourly and checks the Cloud Run
  backend `GET /api/health`, `GET /api/ready`, and frontend availability.
  `curl --fail` makes a non-2xx response or timeout fail the workflow, and
  GitHub's normal scheduled-workflow notifications provide the current
  alert path. Cloud Run intentionally uses scale-to-zero; this workflow is
  monitoring, not a guarantee that an instance stays warm.
- **External cron**: an older cron-job.org monitor previously targeted Render.
  Do not rely on it for current incident detection unless its target has been
  independently confirmed as the Cloud Run URL.
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
3. Check Cloud Run revision/build logs and Vercel deployment logs for the
   most recent release — many incidents immediately follow a deploy.
4. Decide the fix path:
   - **Bad deploy** → see [`docs/release-and-rollback.md`](release-and-rollback.md).
   - **Data loss/corruption** → see [`docs/backups-supabase.md`](backups-supabase.md).
   - **Third-party outage** (Supabase, Google Cloud Run, Vercel, Google OAuth) → check
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
- **Migration failure**: stop the release. Cloud Run has no automatic
  pre-deploy migration hook. For a schema-changing release,
  `f-transactions-migrate` must be rebuilt from the release backend source and
  executed with `--wait` before the service is deployed. If the Job fails,
  investigate it and do not deploy the service. The repository migration
  failure test verifies that broken Alembic migrations exit non-zero; the
  release procedure supplies the deployment gate.

## Post-incident

For any SEV1 or SEV2 incident, write a short note (can be a GitHub issue)
covering: what happened, when it was detected, what fixed it, and one
concrete follow-up to reduce the chance of recurrence. Link it from
`CHANGELOG.md` if it resulted in a code change.
