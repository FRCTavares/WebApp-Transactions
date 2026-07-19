# Supported Browsers

## Matrix

| Browser | Platform | Minimum version | Status |
|---|---|---|---|
| Safari | macOS | 16.4+ | Primary — this app targets Mac and iPhone |
| Safari | iOS | 16.4+ | Primary — this app targets Mac and iPhone |
| Chrome | macOS | 111+ | Primary |
| Chrome | Android | 111+ | Supported, verified in CI, not a primary target |
| Firefox | Desktop | 114+ | Supported, verified in CI |
| Edge | Desktop | 111+ | Supported (Chromium-based; not separately verified) |

Minimum versions come directly from the frontend build target
(`vite.config.ts`, Vite's default `build.target: 'baseline-widely-available'`,
currently `chrome111`/`edge111`/`firefox114`/`safari16.4`/`ios16.4`). Browsers
older than these versions are not supported: the production bundle is not
transpiled for them and may fail to load or run correctly.

## Why these versions

Vite's `baseline-widely-available` target tracks the [Baseline](https://web-platform-dx.github.io/web-features/)
initiative's "Widely Available" browser set — versions that have been stable
across all major engines for at least 30 months. Raising the app's minimum
supported versions happens automatically as Vite's default moves forward;
lowering them would require setting an explicit, older `build.target` in
`vite.config.ts` and accepting the resulting transpilation/polyfill cost.

## Verification

Every push and pull request runs the full Playwright e2e suite
(`frontend/e2e/`) against real engines for all three underlying browser
engines used across the matrix above:

- **Chromium** (`chromium`, `mobile-chromium` projects) — covers Chrome and Edge.
- **Firefox** (`firefox` project).
- **WebKit** (`webkit`, `mobile-webkit` projects) — covers Safari macOS and iOS.

Run it locally with:

```bash
cd frontend
npx playwright test
```

or a single engine with `npx playwright test --project=webkit`.

This is real engine coverage (Playwright ships and drives actual Chromium,
Firefox, and WebKit builds), not a simulation. It is not a substitute for
occasional manual verification on a real iPhone and a real Mac, particularly
for anything relying on iOS Safari's PWA install behavior or Safari's
Intelligent Tracking Prevention, which Playwright's WebKit build does not
fully replicate.

See `TODO_LIST.md` for the current CI status of this suite (frontend unit
tests are a required check; the e2e job runs on every push but is not yet
required — see the note there before treating an e2e failure as blocking).
