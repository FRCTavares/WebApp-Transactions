# Deploying to Cloud Run

This document is artifact-prep for moving the backend from Render to Google
Cloud Run. It does not change anything about auth/allowlist logic, and it
does not run any `gcloud`, `alembic`, or database commands — every command
below is written to be run manually by a human, in the order given.

Current entrypoint: `uvicorn app.main:app` (see `backend/Dockerfile`).
Current source of truth for env vars otherwise: `docs/deployment.md`
(this table supersedes it once Cloud Run is live - update that doc too).

## 1. Environment variables

Set with `--set-env-vars` (plain) or `--set-secrets` (sensitive, backed by
Secret Manager) on `gcloud run deploy` / `gcloud run jobs deploy`. Sensitive
values are financial-app credentials or access-control lists - never pass
them with `--set-env-vars`, never commit them, never put them in Cloud
Build logs.

| Variable | Sensitive? | Example / placeholder | Notes |
|---|---|---|---|
| `APP_ENV` | No | `production` | Enables `validate_production_config()` |
| `API_DOCS_ENABLED` | No | `false` | Keep disabled in production |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:REDACTED@db.xxxxxxxx.supabase.co:5432/postgres` | Same Supabase connection string Render uses today - re-point, don't rotate |
| `CORS_ORIGINS` | No | `https://your-frontend.vercel.app` | Must not contain `*`; unchanged from Render's value since only the backend is moving |
| `SUPABASE_URL` | No | `https://xxxxxxxx.supabase.co` | Derives the JWKS URL and JWT issuer |
| `SUPABASE_JWKS_URL` | No | *(leave unset)* | Only set to override derivation from `SUPABASE_URL` |
| `SUPABASE_JWT_SECRET` | **Yes** | *(leave unset unless legacy)* | Only needed if this Supabase project still issues HS256 JWTs. Confirm in the Supabase dashboard (Auth → JWT settings) before setting - if the project uses JWKS/asymmetric signing (current default for new projects), omit this entirely |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJ...REDACTED` | Only required for the account-deletion flow; never expose outside the backend |
| `ALLOWED_USER_EMAILS` | **Yes** (access-control list, personal data) | `you@example.com` | Comma-separated; empty/unset means anyone can sign in - never leave unset in production |
| `ADMIN_USER_EMAILS` | **Yes** (access-control list, personal data) | `you@example.com` | Comma-separated; controls privileged market-data mutations |
| `RESEND_API_KEY` | **Yes** | `re_REDACTED` | Optional - sign-up notification email only |
| `ADMIN_NOTIFICATION_EMAIL` | No | `you@example.com` | Optional, paired with `RESEND_API_KEY` |
| `LOCAL_NETWORK_ONLY` | No | `false` | Must be `false` in production |
| `MARKET_DATA_TIMEOUT_SECONDS` | No | `15` | |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` | No | `10` | |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | `30000` | |

Not carried over: `RENDER_GIT_COMMIT` is set automatically by Render and
only used for the `version` field of `GET /api/health`. Cloud Run has no
equivalent auto-injected var the app reads, so `version` will report
whatever the app's fallback is once this env var is simply absent - this is
a cosmetic difference only, not something to configure. Cloud Run does
auto-inject `PORT` and `K_SERVICE`/`K_REVISION`, but nothing in `app/`
currently reads those beyond `$PORT` in the Dockerfile's `CMD`.

## 2. Alembic migrations - recommendation (needs your sign-off)

**Render today**: `render.yaml`'s `preDeployCommand: alembic upgrade head`
runs automatically as part of every manually-triggered Render deploy,
before the new instance takes traffic. Cloud Run has no equivalent
pre-deploy hook - a new revision starts serving as soon as it passes health
checks, with nothing built in to gate that on a migration step.

**Recommendation: a separate Cloud Run Job, executed manually before each
service deploy that ships schema changes (Option b).**

Reasoning:

- It runs `alembic upgrade head` inside the *same container image* as the
  deployed service (same Python version, same pinned dependencies, same
  `migrations/` tree) - no risk of a locally-installed Python/psycopg
  version drifting from what's actually deployed.
- `DATABASE_URL` is read from Secret Manager at job execution time, the
  same secret the service itself uses - no risk of a stale or wrong value
  in someone's local `.env` being pointed at production by mistake.
- Cloud Logging gets a durable, timestamped record of exactly when
  migrations ran and what they printed - useful for an app that already
  takes migration/schema safety seriously (see
  `backend/scripts/check_migration_drift.py` and
  `tests/test_migration_failure_blocks_deploy.py`).
- It's still a fully manual, explicit step (`gcloud run jobs execute
  --wait`), matching the same human-gated model Render's
  `autoDeployTrigger: off` already uses today - nothing runs automatically.
- Cost: Cloud Run Jobs bill only for actual execution time. A migration
  run takes seconds, so this stays effectively free.

Rejected alternatives:

- **(a) Cloud Build step before deploy** - would require replacing the
  simple `gcloud run deploy --source` flow with a custom `cloudbuild.yaml`,
  and would run on *every* build (including ones with no schema changes),
  entangling migrations with image builds instead of keeping them as a
  distinct, reviewable step. Also complicates getting `DATABASE_URL` into
  the Cloud Build sandbox securely.
- **(c) Run `alembic upgrade head` locally against the production
  `DATABASE_URL`** - simpler (no second GCP resource to maintain), and
  reasonable for a solo-maintainer project since Supabase Postgres is
  already reachable this way for local dev. Viable fallback if you'd
  rather not stand up a Cloud Run Job, but weaker: no shared execution
  environment guarantee with the deployed image, and no Cloud Logging
  trail. Worth revisiting if the Cloud Run Job ends up feeling like
  overhead for how rarely migrations actually ship.

**This choice needs your explicit confirmation before anything runs against
the production database schema.** The commands below are written for
Option (b); nothing in this repository executes them - they are for you to
run manually, in order, once you've signed off.

### a) Create the Cloud Run Job (one-time setup, and again after any change
to `backend/Dockerfile`, `requirements.txt`, or `migrations/`)

Same source tree and `Dockerfile` as the service in §3 - only the container
`command`/`args` are overridden to run Alembic instead of Uvicorn, so this
job always reflects exactly the migrations that ship with the image you're
about to deploy.

```bash
gcloud run jobs deploy f-transactions-migrate \
  --source ./backend \
  --region REGION \
  --command="alembic" \
  --args="upgrade,head" \
  --set-env-vars="APP_ENV=production" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --max-retries=0
```

`--max-retries=0` is deliberate: an `alembic upgrade head` failure should
stop the rollout and get investigated, not silently retry against a
partially-migrated schema.

### b) Execute the job before every deploy that includes a schema change

```bash
gcloud run jobs execute f-transactions-migrate --region REGION --wait
```

`--wait` blocks until the execution finishes and makes `gcloud` exit
non-zero if it failed - check `$?` after this command:

```bash
echo "exit code: $?"
```

Only proceed to deploy the service (§3) once this exits `0`.

### c) Confirm success before moving on

Don't rely on the exit code alone - confirm both the structured execution
status and the actual Alembic output before deploying the service revision:

```bash
# Structured status of the most recent execution (look for
# "Succeeded" / completionTime, not just that it finished)
gcloud run jobs executions list \
  --job f-transactions-migrate \
  --region REGION \
  --limit=1

# Full logs for that execution - the actual `alembic upgrade head` output,
# or the traceback if it failed. Cloud Run Jobs logs land in Cloud Logging
# under resource.type="cloud_run_job".
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="f-transactions-migrate"' \
  --project PROJECT_ID \
  --order asc \
  --freshness=1h \
  --limit=200
```

If the execution failed, do **not** proceed to §3 - the service would
deploy against a schema that doesn't match its models. Fix the migration
issue, then re-run (b).

## 3. Deploy command

Zero-cost defaults: request-based billing (the default unless
`--no-cpu-throttling` is passed), `min-instances=0` (scales to zero, no
idle cost), `max-instances=3` (caps spend under unexpected load).

```bash
gcloud run deploy f-transactions-api \
  --source ./backend \
  --region REGION \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="APP_ENV=production,API_DOCS_ENABLED=false,LOCAL_NETWORK_ONLY=false,MARKET_DATA_TIMEOUT_SECONDS=15,DATABASE_CONNECT_TIMEOUT_SECONDS=10,DATABASE_STATEMENT_TIMEOUT_MS=30000,CORS_ORIGINS=https://your-frontend.vercel.app,SUPABASE_URL=https://xxxxxxxx.supabase.co" \
  --set-secrets="DATABASE_URL=database-url:latest,ALLOWED_USER_EMAILS=allowed-user-emails:latest,ADMIN_USER_EMAILS=admin-user-emails:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,RESEND_API_KEY=resend-api-key:latest,ADMIN_NOTIFICATION_EMAIL=admin-notification-email:latest"
```

`--allow-unauthenticated` is required so the frontend (and Supabase JWT
verification, which happens inside the app, not at Cloud Run's IAM layer)
can reach it - this mirrors Render's public service today. Replace `REGION`
with your chosen region (pick one close to Supabase's region to minimize
DB round-trip latency). Omit `SUPABASE_JWT_SECRET` entirely unless you
confirmed the legacy-HS256 case in §1.

## 4. Manual checklist

1. [ ] Create/select a GCP project; confirm billing account is attached.
2. [ ] Enable required APIs: `run.googleapis.com`,
       `cloudbuild.googleapis.com`, `secretmanager.googleapis.com`,
       `artifactregistry.googleapis.com`.
3. [ ] Set a budget alert (e.g. $5/month threshold) on the billing account
       - this is a zero-cost target, not a guarantee, and Cloud Run Jobs +
       min-instances=0 should stay within the free tier for personal-app
       traffic, but a budget alert catches surprises.
4. [ ] `gcloud auth login` and `gcloud config set project PROJECT_ID`.
5. [ ] Create secrets in Secret Manager for every "Sensitive" row in the
       table above (`database-url`, `allowed-user-emails`,
       `admin-user-emails`, `supabase-service-role-key`, `resend-api-key`,
       and `supabase-jwt-secret` only if legacy HS256 applies). Use the
       *current* Render values - this is a re-point, not a rotation.
6. [ ] **Get explicit sign-off on the Alembic migration approach in §2**
       if you haven't already.
7. [ ] One-time: deploy the `f-transactions-migrate` Cloud Run Job (§2).
8. [ ] Run the migration job and confirm it exits successfully (§2) -
       **before** the next step. This is the point that matches Render's
       `preDeployCommand`: schema must be current before the new revision
       can take traffic.
9. [ ] Deploy the backend service (§3).
10. [ ] Verify: `curl https://<cloud-run-url>/api/health` returns
        `{"status": "ok", ...}`; `curl https://<cloud-run-url>/api/ready`
        succeeds; check Cloud Run logs for a clean startup (no
        `validate_production_config` errors).
11. [ ] Update the frontend's `VITE_API_BASE_URL` (Vercel env vars) to the
        new Cloud Run URL and redeploy the frontend.
12. [ ] Smoke-test end-to-end against the new backend (sign in, load a
        page of transactions) before decommissioning Render.
13. [ ] Decommission the Render service (suspend first, delete once you're
        confident Cloud Run is stable - don't delete immediately).
