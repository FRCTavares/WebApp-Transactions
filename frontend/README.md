# Frontend

React 19, TypeScript, Vite. See the root [`README.md`](../README.md) for the
overall stack and [`../docs/deployment.md`](../docs/deployment.md) for the
full environment variable reference and setup walkthrough.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in real values, see below
npm run dev                  # http://localhost:5173
```

**Read [`../docs/auth-options.md`](../docs/auth-options.md) before assuming
"local" means "no Supabase needed"** — it doesn't. The backend requires a
real Supabase-verified JWT on every request regardless of
`VITE_SUPABASE_AUTH_ENABLED`; that flag only controls whether the frontend
shows a login screen.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` then `vite build`; output in `dist/` |
| `npm run lint` | ESLint over the whole project |
| `npm run test` | Vitest unit tests (`tests/`) |
| `npm run test -- <pattern>` | Run a subset, e.g. `npm run test -- ImportPage` |
| `npx playwright test` | Full e2e suite across Chromium/Firefox/WebKit — needs a running backend, see below |
| `npx playwright test --project=chromium` | e2e on a single browser engine |

## Running the e2e suite locally

The e2e suite needs a real backend running with real Supabase config (see
[`../docs/auth-options.md`](../docs/auth-options.md) — there's no
auth-bypass mode). `frontend/e2e/global-setup.ts` mints a real
Supabase-shaped JWT locally rather than driving an actual OAuth flow.

1. `frontend/e2e/.env.e2e.local` (gitignored) needs `SUPABASE_JWT_SECRET`,
   `E2E_TEST_EMAIL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Start the backend with the matching `SUPABASE_JWT_SECRET` and
   `CORS_ORIGINS` including `http://127.0.0.1:4173` (Playwright's preview
   server origin).
3. `npx playwright test`.

See [`../docs/browser-support.md`](../docs/browser-support.md) for which
browser engines this covers and why WebKit has one documented, non-product
skip (the offline test).

## Project structure

- `src/pages/` — route-level screens
- `src/components/` — focused, reusable UI, grouped by feature
- `src/hooks/` — reusable state and orchestration (data fetching, auth,
  presentation preferences, online status, etc.)
- `src/api/` — all backend API calls; components never call `fetch`
  directly
- `src/auth/` — Supabase Auth client and the `AuthProvider` context
- `src/i18n/` — English/Portuguese translation strings
- `src/utils/` — date, currency, and amount formatting
- `public/sw.js` — the offline-support service worker, see
  [`../docs/pwa-offline.md`](../docs/pwa-offline.md)
- `tests/` — Vitest unit tests
- `e2e/` — Playwright end-to-end tests

## Adding a new component

1. **Start from an existing `src/components/ui/` primitive** (`Button`,
   `Card`, `Badge`, `Field`, `Modal`, `IconButton`, `SegmentedControl`,
   `Table`, `EmptyState`, `PageHeader`, `Skeleton`, `Toast`, ...) instead of
   writing a new one from scratch. Most screen-level needs are a composition
   of these, not a new primitive.
2. **Reference semantic tokens only.** Use `var(--color-*)`, `var(--space-*)`,
   `var(--radius-*)`, `var(--shadow-*)` / `var(--elevation-*)` from
   `src/styles/tokens/semantic.css` — never a raw hex, `rgb()`/`hsl()` value,
   or a `var(--gray-*)`/`var(--blue-*)`/etc. primitive straight from
   `src/styles/tokens/primitives.css`. If the role you need doesn't exist yet,
   add it to `semantic.css` (and `dark.css` if the dark-theme value differs)
   rather than reaching past it. `npm run lint:css` enforces this for colour;
   there is no exception process.
3. **Never write a component-specific `[data-theme='dark']` selector.** If a
   component looks wrong in dark mode, a semantic role is missing or mapped
   incorrectly in `semantic.css`/`dark.css` — fix it there, not in the
   component's stylesheet.
4. **Avoid `!important`.** The codebase carries a grandfathered baseline
   (`frontend/.stylelint-important-baseline.json`) that new work must not
   grow; if a new component needs one, you're almost always fighting
   specificity that should be fixed at the selector level instead.
5. Preserve existing accessible names, ARIA roles/attributes, and
   `data-testid` values on anything you touch or wrap.

## Linting

The current ESLint config uses `tseslint.configs.recommended`. For stricter
type-aware rules (`recommendedTypeChecked` / `strictTypeChecked` /
`stylisticTypeChecked`) or React-specific rules (`eslint-plugin-react-x`,
`eslint-plugin-react-dom`), see the
[typescript-eslint docs](https://typescript-eslint.io/getting-started/typed-linting)
and [eslint-react](https://github.com/Rel1cx/eslint-react) — not currently
adopted here, but straightforward to add to `eslint.config.js` if desired.
