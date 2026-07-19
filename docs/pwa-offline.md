# PWA and Offline Support

## Decision

Real offline use is required, not just installability (recorded in
`docs/production-roadmap.md`). Offline use is not expected to be exercised
often, but the app must work correctly when it is.

## What "offline" means here

- The app shell (HTML, JS, CSS, icons) loads and renders while offline,
  after at least one prior online visit.
- Whatever data was last successfully loaded (dashboard summary,
  transactions, wealth, etc.) remains visible while offline.
- A visible "You're offline" notice explains that data may be stale and
  that changes can't be saved until the connection returns.
- Writes (creating/editing/deleting anything) are not supported offline.
  They fail with the app's existing network-error handling; nothing is
  queued for later sync. Building real offline write queuing/sync is a
  substantially larger feature and is explicitly out of scope for now.

## How it works

`frontend/public/sw.js` is a small, hand-written service worker — no
build-time precache manifest or PWA build plugin. It uses one strategy
everywhere: **network-first, falling back to cache only when the network
request fails.**

- Only `GET` requests are intercepted. Writes (`POST`/`PUT`/`DELETE`) always
  go straight to the network, so they fail naturally when offline instead of
  silently queuing.
- Static assets and navigations are cached in `finance-static-v1`.
- API `GET` responses (matched by `/api/` path, regardless of which origin
  they're actually served from) are cached separately, in `finance-api-v1`.
- Because the strategy is network-first, a normal online session is never
  served stale data — the cache is a fallback for the offline case only,
  not a performance cache.
- On sign-out (or when a request comes back `401` and the session is
  cleared), the app posts a `CLEAR_API_CACHE` message to the active service
  worker, which deletes `finance-api-v1`. This matters because Cache API
  entries are keyed by URL, not by user — without this, a second person
  signing into the same browser profile on a shared device could otherwise
  be served the previous user's cached financial data while offline.

Registration lives in `frontend/src/main.tsx` and runs in all environments,
including local dev — the network-first strategy makes this safe (normal
dev edits are always served fresh; only a genuine network failure reads
from cache).

## Verification

`frontend/e2e/offline.spec.ts` is a real, reproducible test: it loads the
app online, reloads once so the service worker is controlling the page and
has cached that visit's requests, then uses Playwright's
`context.setOffline(true)` and reloads again, asserting the dashboard still
renders from cache along with the offline notice.

This runs in CI on Chromium and Firefox. It's skipped on WebKit projects —
Playwright's WebKit driver has long-standing, widely-reported flakiness
navigating while `setOffline(true)` is active
([microsoft/playwright#23899](https://github.com/microsoft/playwright/issues/23899),
[#27337](https://github.com/microsoft/playwright/issues/27337),
[#31558](https://github.com/microsoft/playwright/issues/31558)), unrelated
to this app's service worker. Real Safari supports service workers and
offline caching normally; this is a driver limitation, not a product one.
As with the rest of `docs/browser-support.md`, occasional manual
verification on a real iPhone and Mac remains the ground truth for Safari
specifically.
