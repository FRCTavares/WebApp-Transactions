# Project Status and Decisions

Last reviewed: 2026-10-12

Where the project stands, the limits it is run within, and the decisions that still apply. Actionable open work
lives in [`TODO_LIST.md`](../TODO_LIST.md); release notes in [`CHANGELOG.md`](../CHANGELOG.md).

## 1. Status

- **Hosting:** the owner's home server, reachable only over Tailscale, with Google sign-in
  (see [self-hosted.md](self-hosted.md)). The former Vercel / Cloud Run / Supabase deployment was decommissioned on
  2026-10-11. Recurring cost: none.
- **Backups:** dumps three times a day kept 90 days, a copy on a second machine, a monthly isolated restore test
  ([backups.md](backups.md)).
- **Releases:** manual, from the owner's Mac ([release-and-rollback.md](release-and-rollback.md)). There is no hosted
  CI: tests, lint and build are run locally before merging.
- **Scope:** suitable for controlled personal and invited use. A wider or commercial release is blocked by the
  market-data licensing risk in decision 13.

## 2. Accepted constraints

- One operator, no on-call, no availability guarantee: the app is as available as the home server and its internet
  connection.
- Reachable only on the tailnet: a device must have Tailscale to use it.
- Market prices come from Yahoo Finance via `yfinance` (unofficial endpoints): fine for personal use, to be replaced
  by a licensed provider before any public release.
- Ownership is enforced in the service layer only (no row-level security); see
  [multi-user-data-model.md](multi-user-data-model.md).

## 3. When to revisit

- Hosting: if the app needs to be reachable without Tailscale, or the home server's availability stops being
  acceptable.
- Market data: before inviting anyone beyond a small trusted group.
- Backups: if the data becomes harder to re-create than a few hours of loss between dumps allows.

## 6. Resolved Product and Architecture Decisions

Tracked in issue #35. Answers recorded 2026-07-19; each still needs any
consequential implementation work tracked as its own task.

1. Invite-only or open registration? **Invite list plus pending approval** (supersedes the original "open registration" answer): `ALLOWED_USER_EMAILS` and the admin-approved pending sign-ups decide who gets in.
2. Shared, user-specific, or admin-maintained market data? **Shared/admin-maintained** (corrected 2026-07-20 to match the actual implementation — `market_prices`/`market_price_history` are shared, global tables with admin-only writes via `ADMIN_USER_EMAILS`). The original recorded decision said "user-specific"; that was the documentation error, not the code. See `docs/multi-user-data-model.md`.
3. Is moving weighted-average cost suitable for every tax jurisdiction? **No** — jurisdiction-specific cost-basis rules are out of scope for now.
4. Required base currencies? **USD, EUR.**
5. Required launch languages? **Portuguese, English.**
6. Must the app work during backend cold starts? **Yes** (no longer a hosting concern on the home server, but the frontend still tolerates a slow first request).
7. Is local SQLite a first-class deployment? **No** (confirmed 2026-07-20) — dev convenience only; PostgreSQL is the only real deployment target (now on the home server). The legacy SQLite startup migrations exist solely to keep local dev databases working, not as a supported deployment path.
8. Deleted-account retention outside the backup schedule? **1 week.**
9. Should transaction categories become foreign-key references? **No** (confirmed 2026-07-20) — freeform strings are fine for personal use at this scale; not worth the migration complexity/risk right now. Revisit if that changes.
10. Is offline use real or only installability? **Real offline use is required, not just installability** — not expected to be exercised often, but must work when it is. **Implemented**: see `docs/pwa-offline.md`.
11. When does availability justify paid backend hosting? **Not at the current personal/invited scale, by owner preference.** The app moved from Render to Cloud Run and then (2026-10-11) to the owner's home server, reachable only over Tailscale, at no recurring cost.
12. Are users outside Portugal targeted immediately? **No.**
13. Are market-data terms compatible with public release? **No — real, unresolved legal risk if released beyond personal/small-invited-group use.** Researched 2026-07-20: Yahoo's Terms of Service explicitly prohibit automated access/scraping without express written permission, and separately prohibit commercial use of Yahoo API data without permission. `yfinance` (used here) wraps Yahoo's unofficial endpoints — acceptable risk for personal/small-scale use like this project's current "controlled personal and invited-user deployment" (`docs/privacy.md`), but this must be resolved (switch to a licensed market-data provider) before any wider or genuinely public release. Do not treat the Global release readiness scorecard as met until this is addressed.

## 7. Deferred product ideas

These are not current TODO items. Reassess them only when product needs justify
the added complexity.

Complex charts, budget prediction, expanded investment analytics, automatic
bank synchronization, Open Banking, OCR, PDF imports, advanced animations,
complex mobile polish, multi-region deployment, microservices, event-driven
architecture, Kubernetes, premature caching, stack replacement without evidence,
offline write queuing/sync (writes fail naturally offline instead; see
`docs/pwa-offline.md`).
