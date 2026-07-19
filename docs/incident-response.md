# Incident Response

## Ownership

This is a single-owner personal project (Francisco). There is no on-call
rotation or support team. This document exists so that, during an incident,
there's a checklist instead of guesswork.

## Detecting an incident

- `.github/workflows/keep-backend-warm.yml` runs every ~10 minutes and
  checks backend liveness (`/api/health`), backend readiness
  (`/api/ready`, which fails if the database isn't reachable or isn't at
  the expected Alembic head), and frontend availability. A failed run shows
  up in the repo's **Actions** tab.
- GitHub only emails a failure notification for a scheduled workflow if
  Actions notifications are enabled for the account that last edited this
  workflow's schedule — see `docs/production-operations-checklist.md` to
  confirm this is actually turned on.
- Render can also send its own deploy-failure notifications (email, Slack,
  webhook) — configurable in the Render Dashboard, not in this repo. See
  the same checklist.
- Supabase has its own status page and dashboard alerts for the managed
  Postgres instance, independent of this app.

## Triage

1. **Check the failing signal first.** GitHub Actions run logs
   (`keep-backend-warm`) show exactly which check failed (liveness,
   readiness, or frontend) and the HTTP status/timing.
2. **Backend down or unready:** check the Render Dashboard's Logs tab for
   the `f-transactions-api` service. Common causes: cold start still
   warming up (wait ~60s and retry), a failed deploy (see Render's Events
   tab — a bad deploy should have already been auto-rolled-back per
   `docs/release-and-rollback.md`), or the Supabase database being
   unreachable (check the Supabase status page and dashboard).
3. **Frontend down:** check the Vercel Dashboard's Deployments tab for
   `web-app-transactions`. A failed *build* is automatically never promoted
   (the previous working deployment keeps serving traffic). A deployment
   that builds successfully but has a runtime bug is **not** automatically
   rolled back — use Vercel's Instant Rollback (see
   `docs/release-and-rollback.md`).
4. **Database/data issue:** see `docs/backups-supabase.md` for backup and
   restore procedures. Do not attempt ad-hoc data fixes against production
   without a fresh backup first.
5. **Auth/OAuth issue:** check `docs/production-operations-checklist.md`'s
   OAuth section — a change to Google Cloud Console or Supabase Auth
   settings (redirect URIs, authorized domains) is a common cause of
   sudden login failures that isn't visible from this repo.

## Communication

There are no external users to notify formally today (personal/family use
only, per the resolved decisions in `docs/production-roadmap.md`). If usage
grows beyond that, add a status/communication channel here before it's
needed.

## Recovery

- **Code-level regression:** see `docs/release-and-rollback.md`.
- **Data-level issue:** see `docs/backups-supabase.md` for the tested
  backup/restore procedure and its RPO/RTO targets.
- **Hosting-level outage (Render/Vercel/Supabase down):** nothing to do but
  wait; there's no failover to a second provider. If this becomes
  unacceptable, see the upgrade triggers in `docs/production-roadmap.md`.

## After the incident

Add a short note here (or in `CHANGELOG.md` if it resulted in a code
change) describing what happened and what, if anything, changed as a
result. This file intentionally doesn't have a rigid postmortem template —
for a single-owner project, a couple of sentences is enough as long as
it's written down somewhere.
