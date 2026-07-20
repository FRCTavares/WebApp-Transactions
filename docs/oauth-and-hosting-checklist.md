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
- [ ] OAuth scopes requested are minimal — this app only needs `openid`,
      `email`, and `profile`. Confirm nothing broader was added (Google
      Cloud Console → Acesso a dados / Data access).
- [ ] **Publishing status**: was in "Testing" mode (5/100 test users),
      contradicting the recorded "open registration" decision in
      `docs/production-roadmap.md`. Decision made 2026-07-20: move to "In
      production". Blocked on three release gates in `docs/privacy.md`,
      all now satisfied (monitored privacy contact, recorded EU/EEA hosting
      regions, established incident-response procedure) — confirm the
      actual "Publicar app" click completed and check whether Google
      required a verification review.
- [x] Privacy policy link on the consent screen points to a real, public
      page. Built `frontend/src/pages/PrivacyPage.tsx` (public `/privacy`
      route, mirrors `docs/privacy.md`) since `docs/privacy.md` itself isn't
      publicly reachable. Set the Branding page's "Link da Política de
      Privacidade" to `https://web-app-transactions.vercel.app/privacy`
      once this is merged and deployed.

## Supabase (dashboard)

- [ ] **Authentication → URL Configuration**: Site URL and Redirect URLs
      match the exact production frontend domain(s), no trailing slash
      mismatches.
- [ ] **Authentication → Providers → Google**: Client ID/Secret match the
      Google Cloud Console OAuth client actually in use.
- [ ] Database size, egress, and connection count are below plan limits —
      check the dashboard's usage page against the free-tier limits noted
      in `docs/production-roadmap.md`.
- [ ] Backup availability and most recent backup timestamp (Supabase's own
      automatic daily backups — confirm this hasn't silently changed; see
      `docs/backups-supabase.md` for this project's own separate backup
      procedure).
- [ ] Any Supabase-side alerts or warnings on the project overview page.

Suggest checking this section monthly, or whenever usage noticeably changes.

## Render (dashboard)

- [ ] Environment variables match `render.yaml`'s expected keys — nothing
      missing, nothing stale from a previous configuration.
- [ ] **Notifications**: deploy-failure notifications (email/Slack/webhook)
      are configured for the `f-transactions-api` service.
- [ ] `autoDeployTrigger: off` is intentional (see
      `docs/release-and-rollback.md`) — confirm this still reflects how you
      want to deploy.
- [ ] The free-tier hour budget and cold-start behavior are still
      acceptable — see the upgrade triggers in `docs/production-roadmap.md`.

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
