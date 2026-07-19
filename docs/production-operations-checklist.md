# Production Operations Checklist (Dashboard-Only)

Everything on this page requires access to a dashboard (Google Cloud
Console, Supabase, Render, GitHub notification settings) that isn't
available from this repository. Nothing here can be verified or automated
from code — it needs you to actually check it. Tick items off as you
confirm them; this file is meant to be edited in place.

## GitHub Actions notifications

- [ ] Confirm GitHub Actions notifications are enabled for your account:
  **GitHub → Settings → Notifications → Actions**. Without this, a failing
  `keep-backend-warm` run (see `docs/incident-response.md`) won't actually
  reach you — it'll just sit in the Actions tab.
- [ ] Consider "Only notify for failed workflow runs" so this doesn't add
  noise for the routine successful 10-minute pings.

## Render

- [ ] **Render Dashboard → Notifications**: confirm deploy-failure
  notifications (email/Slack/webhook) are configured for the
  `f-transactions-api` service.
- [ ] Confirm the free-tier hour budget and cold-start behavior are still
  acceptable — see the upgrade triggers in `docs/production-roadmap.md`.

## Vercel

- [ ] **Vercel Dashboard → Project → Notifications**: confirm build-failure
  notifications are configured for `web-app-transactions`.

## Supabase capacity and backups

Check periodically (suggest monthly, or whenever usage noticeably
changes) in the **Supabase Dashboard**:

- [ ] Database size against the free-tier limit.
- [ ] Egress against the free-tier limit.
- [ ] Active connection count.
- [ ] Backup availability and most recent backup timestamp (Supabase's
  automatic daily backups on the free tier — confirm this hasn't silently
  changed; see `docs/backups-supabase.md` for this project's own backup
  procedure, which is separate from Supabase's).
- [ ] Any Supabase-side alerts or warnings on the project overview page.

## Google OAuth production requirements

- [ ] **Google Cloud Console → APIs & Services → OAuth consent screen**:
  app name, logo, and support email are accurate (users see this on the
  Google sign-in screen).
- [ ] **Authorized JavaScript origins** includes the production frontend
  domain (`https://web-app-transactions.vercel.app` and any custom domain
  in use).
- [ ] **Authorized redirect URIs** includes the exact Supabase Auth
  callback URL for this project (**Supabase Dashboard → Authentication →
  URL Configuration** shows the exact value to copy — it follows the
  pattern `https://<project-ref>.supabase.co/auth/v1/callback`, but copy
  the real one rather than assuming).
- [ ] **OAuth scopes requested** are minimal — this app only needs
  `openid`, `email`, and `profile`. Confirm nothing broader was added.
- [ ] **Publishing status**: if the consent screen is still in "Testing"
  mode, only explicitly added test users can sign in — confirm this
  matches the resolved "open registration" decision in
  `docs/production-roadmap.md`, or move to "In production" (which may
  trigger Google's verification review for some scope/branding
  combinations).
- [ ] **Supabase Dashboard → Authentication → URL Configuration**: Site
  URL and Redirect URLs list match the actual production frontend domain(s).

## Re-verify after any of these change

- The Vercel production domain (custom domain added/changed).
- The Supabase project (if ever recreated).
- The Google Cloud project or OAuth client (if ever recreated).

Any of the above silently breaks login without changing anything in this
repository, which is why this list exists.
