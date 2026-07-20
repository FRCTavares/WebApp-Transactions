# OAuth and Hosting Checklist

Part of #33 (closed). These items require access to dashboards this
assistant doesn't have: Google Cloud Console, Supabase, Render, Vercel, and
GitHub notification settings. Nothing here can be verified or automated
from code — it needs the project owner to actually check it. Tick items
off as you confirm them; this file is meant to be edited in place.

## GitHub Actions notifications

- [x] Confirm GitHub Actions notifications are enabled for your account:
      **GitHub → Settings → Notifications → Actions**. Without this, a
      failing `keep-backend-warm` run (see `docs/incident-response.md`)
      won't actually reach you — it'll just sit in the Actions tab.
      Confirmed 2026-07-20: on, via GitHub + Email.
- [x] Consider "Only notify for failed workflow runs" so this doesn't add
      noise for the routine successful 10-minute pings. Confirmed
      2026-07-20: already scoped to "Failed workflows only".

## Google OAuth (Google Cloud Console)

Note: this project's Google Cloud project ("Fitness Dashboard Auth") and
OAuth client/consent screen are intentionally shared with another,
unrelated app of the owner's. The authorized-domains list legitimately
includes that other app's Vercel/Supabase domains alongside this one.

- [x] App branding (name, logo, support email) is accurate, not a default
      placeholder — users see this on the Google sign-in screen. Confirmed
      2026-07-20: OAuth client named "F Transactions Web", real logo, real
      support email.
- [x] **Authorized JavaScript origins** includes the exact production
      frontend domain (`https://web-app-transactions.vercel.app` and any
      custom domain actually in use), no trailing slash. Confirmed
      2026-07-20.
- [x] **Authorized redirect URIs** includes the exact Supabase Auth
      callback URL for this project. Confirmed 2026-07-20:
      `https://stddbcpdpblqtwcseygg.supabase.co/auth/v1/callback`, which
      matches the live `SUPABASE_URL` on Render.
- [x] OAuth scopes requested are minimal — this app only needs `openid`,
      `email`, and `profile`. Confirmed 2026-07-20: zero scopes configured
      under non-sensitive/sensitive/restricted in Data access — nothing
      beyond the default OpenID Connect sign-in flow was ever added.
- [x] **Publishing status**: was in "Testing" mode (5/100 test users),
      contradicting the recorded "open registration" decision in
      `docs/production-roadmap.md`. Resolved 2026-07-20: moved to "Em
      produção" (In production) after the three `docs/privacy.md` release
      gates were satisfied. No verification review was required since the
      app requests zero sensitive/restricted scopes (confirmed above) — the
      100-user cap only applies to unverified apps requesting those. Note:
      Google's separate *brand* verification is still pending, so new users
      may see a "Google hasn't verified this app" interstitial (with a
      click-through option) instead of the branded consent screen. Not a
      registration blocker; not worth pursuing at this scale.
- [x] Privacy policy link on the consent screen points to a real, public
      page. Built `frontend/src/pages/PrivacyPage.tsx` (public `/privacy`
      route, mirrors `docs/privacy.md`). Confirmed 2026-07-20: Branding
      page's "Link da Política de Privacidade" is set to
      `https://web-app-transactions.vercel.app/privacy`.

## Supabase (dashboard)

- [x] **Authentication → URL Configuration**: Site URL and Redirect URLs
      match the exact production frontend domain(s), no trailing slash
      mismatches. Confirmed 2026-07-20: Site URL
      `https://web-app-transactions.vercel.app`; Redirect URLs are that plus
      `http://localhost:5173`.
- [x] **Authentication → Providers → Google**: Client ID/Secret match the
      Google Cloud Console OAuth client actually in use. Confirmed
      2026-07-20: Client ID
      `1025162530033-3u76h8gfq0d5cggmokiafmedhhuum7mp.apps.googleusercontent.com`
      matches exactly.
- [x] Database size, egress, and connection count are below plan limits —
      check the dashboard's usage page against the free-tier limits noted
      in `docs/production-roadmap.md`. Confirmed 2026-07-20: 0.031 GB
      database size, 0.519 GB egress, 1 MAU — trivially below Free plan
      limits.
- [x] Backup availability and most recent backup timestamp. Real finding
      2026-07-20: **Supabase Free plan includes zero built-in backups at
      all** ("Free Plan does not include project backups" on the Backups
      page) — this checklist item's original wording wrongly assumed
      Supabase provided automatic daily backups as a baseline. The only
      actual backup mechanism was this project's own manual `pg_dump`
      procedure in `docs/backups-supabase.md`, which — per direct
      confirmation — was documented but not actually being run
      consistently. Fixed by automating it:
      `.github/workflows/backup-database.yml` now runs it daily via GitHub
      Actions (see `docs/backups-supabase.md` for the honest retention
      caveat — GitHub's 90-day artifact cap means the seven-daily and
      four-weekly tiers are covered, not the full twelve-monthly tier).
- [x] Any Supabase-side alerts or warnings on the project overview page.
      Investigated 2026-07-20: overview showed "Postgres: 119 requests, 111
      errors" (20.1% success) in the last hour, all
      `schema "pg_pgrst_no_exposed_schemas" does not exist` (3F000). This is
      a documented, benign Supabase quirk that happens whenever the Data
      API (PostgREST) is disabled for a project — confirmed via Project
      Settings → Data API: "Enable Data API" is off, and Supabase's own UI
      states this will produce exactly these `/rest/v1/` errors. Correct
      and intentional for this app (backend talks to Postgres directly via
      SQLAlchemy, never through Supabase's Data API). No action needed.

Suggest checking this section monthly, or whenever usage noticeably changes.

## Render (dashboard)

- [x] Environment variables match `render.yaml`'s expected keys — nothing
      missing, nothing stale from a previous configuration. Real finding
      2026-07-20: `SUPABASE_SERVICE_ROLE_KEY` was completely absent, meaning
      account deletion was silently broken in production (fails with a
      controlled 503, not a crash, per
      `app/services/account_deletion_service.py`). Fixed: added the
      **legacy** `service_role` JWT key (Supabase → Settings → API Keys →
      "Legacy anon, service_role API keys" tab) rather than the newer
      `sb_secret_...` key format, since the existing code was written and
      tested against the JWT-style key and swapping to the new format
      untested wasn't worth the risk. Deployed and confirmed live
      2026-07-20. The other missing vars
      (`API_DOCS_ENABLED`/`MARKET_DATA_TIMEOUT_SECONDS`/
      `DATABASE_CONNECT_TIMEOUT_SECONDS`/`DATABASE_STATEMENT_TIMEOUT_MS`)
      are harmless — their code-level defaults already match what
      `render.yaml` would set.
- [x] **Notifications**: deploy-failure notifications (email/Slack/webhook)
      are configured for the `f-transactions-api` service. Confirmed
      2026-07-20: "Only failure notifications" (workspace default).
- [x] Real finding 2026-07-20: **Health Check Path was set to `/api/health`
      in the Render dashboard, not `/api/ready` as `render.yaml` specifies**
      — a drift between committed config and actual dashboard state.
      `/api/health` returns `{"status": "ok"}` unconditionally;
      `/api/ready` (`app/routers/health.py`) actually checks database
      connectivity. With the wrong path configured, Render's zero-downtime
      deploy gate could route traffic to a new instance that can't reach
      the database. Fixed: changed to `/api/ready` in the dashboard,
      confirmed live.
- [x] `autoDeployTrigger: off` is intentional (see
      `docs/release-and-rollback.md`) — confirmed 2026-07-20, still
      reflects how the owner wants to deploy.
- [x] The free-tier hour budget and cold-start behavior are still
      acceptable — confirmed 2026-07-20: owner does not want to pay for
      hosting; free tier remains the deliberate choice regardless of
      cold-start tradeoffs.

## Vercel (dashboard)

- [ ] Production domain and any preview/custom domains match what's
      configured in Google/Supabase above.
- [ ] **Notifications**: build-failure notifications are configured for
      `web-app-transactions`.
- [ ] Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `VITE_API_BASE_URL`, `VITE_SUPABASE_AUTH_ENABLED`) are set correctly
      for Production (and Preview, if previews are actually used against a
      real backend).

## Render cold-start / keep-warm policy

Resolved decision (`docs/production-roadmap.md`, decision #6): the app must
work during backend cold starts — cold starts are accepted, not eliminated.
Given that, the recommendation is:

**Keep `.github/workflows/keep-backend-warm.yml` running, but treat it as
monitoring infrastructure first and a warmth-keeping mechanism second.** It
pings health/readiness/frontend every 10 minutes regardless; its failure is
what feeds the incident-detection path in `docs/incident-response.md`. It
does not, and cannot, guarantee uptime on Render's free tier — see the
Upgrade Triggers in `docs/production-roadmap.md` for when that tradeoff
should be revisited.

- [ ] Confirm you're comfortable with this framing, or decide to remove/
      change the workflow if the monitoring value doesn't justify its
      GitHub Actions minutes.

## Re-verify after any of these change

- The Vercel production domain (custom domain added/changed).
- The Supabase project (if ever recreated).
- The Google Cloud project or OAuth client (if ever recreated).

Any of the above silently breaks login without changing anything in this
repository, which is why this checklist exists.
