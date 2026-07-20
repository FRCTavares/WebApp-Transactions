# Frontend Design System — Audit and Implementation Plan

Status: **open work**. Tracked in [`TODO_LIST.md`](../TODO_LIST.md) section 12.

Audited 2026-07-20 against `frontend/src` at that date. This document is the
specification; `TODO_LIST.md` holds the ordered, checkable tasks.

## 0. Decisions taken before this plan was written

| Decision | Choice | Rejected alternatives |
| --- | --- | --- |
| Refactor depth | Token-first refactor, plain CSS, no new runtime dependencies | Tailwind + shadcn/ui; surface-patching only |
| Visual direction | Refined version of the current light neutral fintech look | Linear/Vercel dark-first; Apple/iOS native |
| Charts | Keep the hand-rolled SVG charts, polish them | Migrate to Recharts |

These are settled. Do not reopen them mid-implementation.

## 1. Why the app looks unpolished

The symptom is "nothing quite matches". The cause is that there is no design
system — there are 37 hand-written stylesheets that each re-decide what a
border, a radius, a grey, and a hover state are.

Measured state of `frontend/src` at audit time:

| Metric | Value |
| --- | --- |
| Stylesheets under `src/styles/` | 37 (plus `index.css` at 854 lines) |
| Hardcoded `#rrggbb` literals in CSS | 216 |
| Design tokens actually defined | 20, in `theme.css` |
| CSS files that consume those tokens | almost none outside the dark theme |
| Dark mode implementation | `theme-dark.css` (618 lines) + `theme-dark-overrides.css` + `investments-dark.css`, all pure overrides |
| `transition` declarations in the whole app | 1, and it is the `prefers-reduced-motion` reset |
| Broken `var()` references | 19, across 7 undefined variable names |
| Hidden stylesheet dependency | `shell.css` (701 lines, the global app shell) is reachable only via an `@import` at the top of `dashboard.css` |
| Dead asset | `public/icons.svg`, referenced by nothing in the repo |

Two structural consequences follow, and they explain almost every visual
defect on the list below:

1. **Tokens exist but are not used.** `theme.css` defines `--theme-bg`,
   `--theme-surface`, `--theme-border`, `--theme-text` and so on, but
   `base.css`, `tables.css`, `charts.css` and the page sheets all write raw
   hex. So changing a colour means finding 216 places, and dark mode has to
   be a 618-line shadow copy of the light theme rather than a token swap.
2. **Load order is load-bearing.** `main.tsx` imports `index.css` first, then
   `theme.css`, `theme-dark.css`, and finally `theme-dark-overrides.css`.
   Dark mode only renders correctly because those files happen to be last in
   source order. Any import reshuffle silently breaks the theme.

## 2. Confirmed defects

Everything in this section was verified against source, not inferred. Each
item names the file so it can be fixed without re-searching.

### 2.1 Broken and missing fundamentals

- **19 `var()` references point at variables that are never defined
  anywhere**, across 7 undefined names: `--muted`, `--border`,
  `--border-subtle`, `--surface`, `--surface-elevated`, `--text`, and
  `--text-muted`. Five are in `index.css`, fourteen in
  `transaction-repayment.css`. The defined names all carry a `--theme-`
  prefix. `color: var(--muted)` with no fallback resolves to `unset` and
  inherits; `border: 1px solid var(--border)` and
  `background: var(--surface)` are invalid at computed-value time, so
  `.category-detail-panel` and `.unlock-card` render with no border, and the
  entire Money-In repayment panel renders with no background or border.
  These are live rendering bugs, not stylistic ones.

  *(Fixed in Phase 0. The original audit pass reported only 9 because it
  searched for four variable names rather than diffing every used `var()`
  name against every defined one. Do that diff, not a name guess.)*
- **The app's chosen typeface is never loaded.** `base.css` declares
  `font-family: Inter, ui-sans-serif, system-ui, ...`, but `index.html` has
  no font `<link>` and no stylesheet has an `@font-face`. Every screen falls
  back to the system font. The whole typographic scale in `typography.css`
  was tuned against a font that is not rendering.
- **Variable-font weights are used without a variable font.** `charts.css`
  sets `font-weight: 760`, `850`, and `900` on chart labels and legends.
  With no Inter loaded, these snap to the nearest static weight, so labels
  that were meant to differ render identically.
- **`<meta name="theme-color">` is `#0f172a`.** That matches neither the
  light background (`#f5f5f7`) nor the dark one (`#09090b`). On iOS — the
  primary target — the status bar tint is wrong in both themes.

### 2.2 Buttons and interactive states

- **`.primary-button:hover` sets `background: #16a34a`, which is the same as
  its resting background** (`base.css`). The primary call-to-action on every
  page has no hover feedback at all.
- **There is no `:active` state anywhere**, so nothing responds to being
  pressed. On touch this reads as an unresponsive app.
- **There are effectively no transitions.** A single `transition` token
  exists in the codebase and it is the reduced-motion kill switch. Every
  hover, theme switch, and disclosure toggle snaps instantly.
- **Focus indicators are inconsistent.** `base.css` gives most controls
  `outline: 2px solid #2563eb; outline-offset: 2px`, but
  `.mobile-bottom-nav button:focus-visible` replaces it with
  `box-shadow: inset 0 0 0 1px #cbd5e1` — a 1px light-grey ring on white,
  which fails contrast for a focus indicator and is invisible in dark mode.
- **Button sizing is redefined per context rather than by variant.**
  `base.css` sets `padding: 8px 11px`; then `.toolbar button`,
  `.page-header button`, `td .action-group button`,
  `.transaction-mobile-actions button`, `.mobile-more-actions button`,
  `.month-navigator button`, `.small-button`, and
  `.investment-trend-window-selector button` each redefine padding, height,
  and font size independently. There are at least eight de facto button
  sizes.
- **Disabled state is a blanket `opacity: 0.5`**, which drags borders and
  text below contrast minimums instead of using a proper disabled palette.

### 2.3 Forms

- **`input, select, textarea { min-width: 220px }` is global** (`base.css`).
  This is why filter rows and inline table inputs overflow — every later
  narrow context has to fight it back with `min-width: 0`, which
  `.table-input`, `.modal-card input`, and the owed-split dialog all do
  separately.
- **No error, warning, or success state exists for a field.** Validation
  feedback is delivered only through the page-level `StatusMessage`
  banner, so a user gets "something is wrong" without knowing which input.
- **Labels are `font-weight: 600` in `.form-grid` and `700` in
  `.form-row`** — the same visual element, two weights.
- **No helper-text or required-field convention** exists at all.

### 2.4 Tables

- **Conflicting duplicate media queries.** `tables.css` contains two
  separate `@media (max-width: 800px)` blocks that both set `th, td`
  padding and font size (`8px`/`13px`, then `7px`/`12px`), both set
  `.table-wrap` negative margins (`-14px`, then `-12px`), both set
  `.table-wrap table` min-width, and both set `.badge`. The declarations are
  interleaved rather than wholly duplicated — some of the first block is
  dead, some still applies — which is exactly why it survived review.
  *(Consolidated into one block in Phase 0, preserving computed values.)*
- **`.badge` font-size drops to `10.5px` on mobile** — a half-pixel size,
  below any reasonable legibility floor.
- **`thead th { position: sticky; top: 0 }` cannot work as written.**
  `.table-wrap` sets `overflow-x: auto` with no height constraint, so there
  is no vertical scroll container for the header to stick within.
- **Row striping uses `#fdfdfd`** against a `#ffffff` surface — a 1-step
  difference that is invisible on most displays, so the striping does
  nothing while still adding a rule to maintain.
- **`.badge { text-transform: capitalize }`** mangles acronyms and
  multi-word source names.
- **Empty and loading states are inconsistent.** Some tables use
  `td[colspan]` centred text, some render nothing; there is no skeleton
  anywhere, so tables jump from blank to full.
- **Mobile drops the table entirely for a card list** in
  `transactions-mobile` but not in the other table surfaces, so the mobile
  experience is only coherent on one page.

### 2.5 Charts

The four hand-rolled SVG charts are `InvestmentPortfolioTrendChart`,
`InvestmentAllocationCharts`, `ExpenseCategoryDonutChart`, and
`WealthMonthlyChart`.

- **Chart polish was previously done by hiding features.** `charts.css`
  sets `display: none` on `.trend-chart-grid-line`, `.wealth-chart-area`,
  `.wealth-chart-edge-point`, and `.wealth-chart-value-label`. The markup
  still renders them. So the charts have no gridlines, no area fill, and no
  value labels — not by design, but by suppression.
- **`!important` is used 15 times in `charts.css`** to force the Wealth
  inner card to stop looking like a card, because the component nests a card
  inside a card. That is a markup problem being solved in CSS.
- **The chart palette lives in TypeScript, not in tokens.**
  `ExpenseCategoryDonutChart` uses a hardcoded `SLICE_COLOURS` array, so
  donut colours cannot respond to the theme and cannot be reused by the
  legend or by other charts.
- **Donut slices are click targets but not buttons.** Each slice is a
  `<circle>` with an `onClick` and no `role`, no `tabIndex`, and no key
  handler — mouse-only interaction.
- **No chart has a tooltip, a hover state, or a crosshair.** Reading an
  exact value at a point in time is impossible.
- **Axes are minimal to absent.** There is a baseline and a few labels; no
  y-axis ticks, no gridlines, no currency formatting on axis labels.
- **Dark mode for charts is a second hardcoded palette** (`#3f78f6` light,
  `#6f98f7` dark, and so on) rather than a token that flips.

### 2.6 Icons

- **`lucide-react` is used in exactly three files** — `AppSidebar.tsx`,
  `AppMobileNav.tsx`, `AppMobileMorePage.tsx`. Navigation has icons; the
  rest of the application has none.
- **Everything else uses text or CSS pseudo-content.** Disclosure affordances
  are literally `content: "Show"` / `content: "Hide"` in
  `base.css` (`.compact-filter-panel`) and again in `index.css`
  (`.wealth-mobile-account-group-header`). Table sort, row actions, empty
  states, and status banners are all text-only.
- **`public/icons.svg` was a sprite sheet that nothing imported** — a third
  icon approach abandoned partway. *(Deleted in Phase 0.)*
- **No icon size scale.** Sizes are passed inline per usage site.

### 2.7 Layout, spacing, and pages

- **Two competing page scaffolds.** `base.css` has `.page-header` / `.cards`
  / `.card`; `index.css` has a newer `.app-page` / `.page-title-block` /
  `.summary-grid` / `.content-card` baseline, described in its own comment
  as "Dashboard is the first page using this visual baseline". Some pages
  use one, some the other, and `.page-header` gets a `min-height: 3.5rem`
  in `index.css` that only makes sense for the old one.
- **Per-page alignment patches instead of shared rules.** `index.css` ends
  with three blocks of `.transactions-page ... { margin-bottom: 0 }` and
  `.investments-page-polished ... { margin-bottom: 0 }` overrides, each
  undoing spacing that a shared sheet applied. The class name
  `investments-page-polished` is itself the tell — polish was applied as a
  per-page opt-in rather than as the default.
- **Spacing units are mixed arbitrarily.** `rem` and `px` are used
  interchangeably for the same role, sometimes in adjacent rules
  (`gap: 1.35rem` next to `gap: 8px`). There is no spacing scale; observed
  values include 4, 5, 6, 7, 8, 10, 11, 12, 14, 16, 18, 20, 24 px plus
  0.12/0.15/0.22/0.25/0.35/0.4/0.45/0.5/0.55/0.65/0.75/0.85/0.9/0.95/1.15/1.35 rem.
- **Radii are equally unsystematic**: 8px, 10px, 12px, 14px, 0.45rem,
  0.5rem, 0.65rem, 0.75rem, 0.8rem, 0.85rem, 0.9rem, 0.95rem, 1rem,
  1.15rem, 999px.
- **The global app shell loads through a page stylesheet.** `shell.css` is
  701 lines defining `:root`, `body`, `.app-shell`, and `.sidebar`, and the
  only thing that pulls it in is an `@import './shell.css'` on line 1 of
  `dashboard.css`. Nothing in `main.tsx` or `index.css` references it. So
  the entire application chrome is a transitive dependency of the Dashboard
  page's stylesheet, and deleting or reordering that one import would strip
  the shell from every page. Phase 1 must hoist this into the declared
  import manifest.
- **Breakpoints are inconsistent**: 420, 520, 800, 900, 1100px, with no
  named tokens, and `800px` is used both for "tablet" and "phone" logic.
- **`!important` and `display: none !important`** are used to force mobile
  layout decisions (`.desktop-only`, `.wealth-owed-summary-card`,
  `.wealth-active-summary-card`), meaning mobile layout is not composable.

### 2.8 Dark mode

- **Dark mode is 618 + n lines of overrides**, not a theme. `theme-dark.css`
  opens with a single selector list of ~25 comma-separated
  `:root[data-theme='dark'] .some-card` entries, all applying the same
  surface treatment — because the light rules hardcoded that surface instead
  of using `--theme-surface`.
- **Every new component must be manually added to that selector list** or it
  renders light-on-dark. This is the single largest source of future
  inconsistency in the app.
- **Three separate dark files** (`theme-dark.css`,
  `theme-dark-overrides.css`, `investments-dark.css`) with no stated
  boundary between them.
- **Theme switching has no transition**, so toggling flashes.

### 2.9 Feedback, empty, and error states

- **`StatusMessage` is the only feedback primitive** — a full-width banner
  with two variants (`status-error`, `status-ok`). There is no toast, no
  inline field error, no warning or info variant, and no dismiss.
- **No skeletons.** `loading-states.css` and
  `investment-loading-states.css` provide one centred spinner panel for the
  whole dashboard. Every other async surface pops in.
- **Empty states are bare sentences** where they exist at all, with no
  illustration, no explanation, and no call to action.
- **No confirmation pattern for destructive actions** beyond a red-tinted
  button.

## 3. Target system

Build this once, in `src/styles/tokens/`, then migrate everything onto it.
Nothing below requires a new dependency.

### 3.1 Token layer

Three files, imported first and only first:

```
src/styles/tokens/primitives.css   raw scales — never referenced by components
src/styles/tokens/semantic.css     role tokens — the only thing components use
src/styles/tokens/dark.css         semantic token overrides for [data-theme='dark']
```

**`primitives.css`** — the raw material:

- Colour ramps at 50/100/200/300/400/500/600/700/800/900 for `neutral`,
  `blue`, `green`, `amber`, `red`, `violet`. Derive these from the hex
  values already in use so the app does not visibly change colour.
- Spacing scale on a 4px base, named `--space-0` … `--space-16`
  (0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64). Every arbitrary value in
  section 2.7 maps to the nearest step.
- Radius scale: `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 14px,
  `--radius-xl` 20px, `--radius-full` 999px. Five values, not fifteen.
- Elevation: `--shadow-xs` … `--shadow-lg`, four steps, each defined once.
- Type scale: sizes 11/12/13/14/16/19/24/30/38, weights 400/500/600/700,
  line heights tight/normal/relaxed, and three tracking values.
- Motion: `--duration-fast` 120ms, `--duration-base` 180ms,
  `--duration-slow` 280ms, `--ease-out`, `--ease-spring`.
- Breakpoints as documented constants (`--bp-sm` 520, `--bp-md` 800,
  `--bp-lg` 1100, `--bp-xl` 1400). CSS cannot use variables in media
  queries; keep these as the single documented source and use the literal
  values consistently.
- Z-index scale: `--z-base`, `--z-dropdown` 80, `--z-sticky` 40,
  `--z-modal` 50, `--z-toast` 90. The current values (1, 20, 40, 50, 60,
  80) are ad hoc and already collide.

**`semantic.css`** — the only layer components may reference:

```
--color-bg, --color-bg-subtle
--color-surface, --color-surface-raised, --color-surface-sunken
--color-border, --color-border-strong, --color-border-focus
--color-text, --color-text-muted, --color-text-subtle, --color-text-inverse
--color-accent, --color-accent-hover, --color-accent-active, --color-accent-subtle
--color-positive / -hover / -subtle / -text
--color-negative / -hover / -subtle / -text
--color-warning / -subtle / -text
--color-info / -subtle / -text
--chart-1 … --chart-8, --chart-grid, --chart-axis, --chart-baseline
```

**`dark.css`** redefines only those semantic names. When this is done
correctly, `theme-dark.css`, `theme-dark-overrides.css`, and
`investments-dark.css` are deleted outright — roughly 800 lines removed and
dark mode stops being something that has to be maintained per component.

**Hard rule going forward:** no hex literal may appear outside
`primitives.css`. Enforce it (section 5).

### 3.2 Primitive components

Add `src/components/ui/`. Each is a thin, typed wrapper over a native
element — no new library, no behaviour change, just one place where each
element's appearance is decided.

| Component | Replaces | API |
| --- | --- | --- |
| `Button` | ~8 ad hoc button styles | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md \| lg`, `loading`, `iconLeft/iconRight`, `fullWidth` |
| `IconButton` | inline square buttons in table rows | `icon`, `label` (required, becomes `aria-label`), `variant`, `size` |
| `Card` | `.card`, `.panel-card`, `.content-card`, `.settings-card`, `.summary-card`, `.dashboard-panel` | `padding`, `elevation`, `interactive` |
| `Field` | bare `<label><input>` pairs | `label`, `hint`, `error`, `required`, wraps input/select/textarea |
| `Badge` | `.badge` + 10 modifier classes | `tone: neutral \| positive \| negative \| warning \| info \| accent`, `size` |
| `Table` | raw `<table>` + `.table-wrap` | header/body/row/cell subcomponents, `sortable`, `sticky`, `loading`, `empty` |
| `Modal` | `.modal-backdrop` / `.modal-card` | wraps existing `useDialogAccessibility`, `size`, `title`, `footer` |
| `Skeleton` | nothing — new | `variant: text \| block \| circle`, `width`, `height` |
| `EmptyState` | scattered `<p>` fallbacks | `icon`, `title`, `description`, `action` |
| `Toast` | nothing — new | `tone`, `title`, `description`, auto-dismiss, with a `ToastProvider` |
| `SegmentedControl` | `.mobile-segmented-control`, `.investment-trend-window-selector` | `options`, `value`, `onChange` |
| `PageHeader` | `.page-header` and `.page-title-block`, which currently coexist | `title`, `eyebrow`, `description`, `actions` |

**Critical constraint:** the existing test suite selects on text and ARIA
roles (11 unit test files, 7 Playwright specs across 5 browser projects).
Every primitive must preserve the existing accessible name and role of the
element it replaces. Where a `data-testid` or `aria-label` exists today,
keep it byte-identical. Run `npm run test` and `npm run test:e2e` after each
component migration, not just at the end.

### 3.3 Target stylesheet structure

From 37 files down to a predictable tree:

```
src/styles/
  tokens/primitives.css
  tokens/semantic.css
  tokens/dark.css
  base/reset.css          element resets, box-sizing, reduced-motion
  base/typography.css     the type scale, applied to elements not classes
  base/layout.css         app shell, page scaffold, grid helpers
  components/*.css        one file per ui/ primitive, colocated by name
  features/*.css          only genuinely page-specific rules
```

Import order is declared once, in `main.tsx`, with a comment stating that
the order is significant: tokens, then base, then components, then features.
`index.css` stops being an 854-line grab bag and becomes an import manifest.

### 3.4 Chart specification

Keep the SVG. Add a small shared `src/components/charts/` layer:

- `useChartScale` — a hook returning `xScale`, `yScale`, `ticks`, and
  `formatTick`, so all four charts compute geometry the same way.
- `ChartAxis`, `ChartGrid`, `ChartTooltip`, `ChartLegend` — shared
  presentational pieces. Delete the `display: none` suppressions in
  `charts.css` and render gridlines properly instead of hiding them.
- Move `SLICE_COLOURS` out of `ExpenseCategoryDonutChart.tsx` into
  `--chart-1` … `--chart-8` semantic tokens, read via `var()` in CSS. All
  four charts then share one palette that flips with the theme, and the
  legend swatch and the slice are guaranteed to match.
- Give every chart three states: loading (skeleton at the chart's real
  height, so nothing reflows), empty (an `EmptyState`, not a bare
  sentence), and error.
- Make interaction accessible: donut slices become
  `role="button" tabIndex={0}` with an `onKeyDown` for Enter/Space and a
  visible focus ring, or the interaction moves entirely to the legend
  buttons — which already are real buttons.
- Add a hover tooltip with a crosshair to the two trend charts, and format
  y-axis labels as currency using the existing `utils/format.ts`.
- Fix the nested-card markup in `WealthMonthlyChart` so that the 14
  `!important` declarations in `charts.css` can be deleted rather than
  preserved.

### 3.5 Icon specification

- Standardise on `lucide-react`, which is already a dependency. Delete
  `public/icons.svg`.
- Create `src/components/ui/Icon.tsx` exporting a named icon map and a
  fixed size scale (`xs` 14, `sm` 16, `md` 20, `lg` 24). No inline sizes.
- Replace the `content: "Show"` / `content: "Hide"` pseudo-elements in
  `base.css` and `index.css` with a rotating `ChevronDown`. Keep an
  `aria-expanded` on the summary element so the state stays announced.
- Add icons where they carry meaning and nowhere else: table row actions
  (edit, delete, mark owed), sort direction, status banner tones, empty
  states, import source rows, and the primary action on each page header.
- Every standalone icon button needs an `aria-label`. `IconButton` makes
  `label` a required prop specifically to enforce this.

## 4. Implementation plan

Seven phases. Each is independently shippable, each ends with the project's
mandatory post-edit verification, and the order is chosen so that later
phases get progressively cheaper.

**Phase 0 — Correctness fixes (small, do first, ship alone).**
Fix the 9 broken `var()` references, load Inter properly (self-host via
`@fontsource` or add a preconnected Google Fonts link — self-hosting is
preferred so the PWA works offline), correct `<meta name="theme-color">` to
respond to the theme, give `.primary-button` a real hover, delete
`src/styles/shell.css` and `public/icons.svg`, and remove the dead duplicate
`@media (max-width: 800px)` block in `tables.css`. No visual redesign.
This phase alone will make the app look noticeably more finished.

**Phase 1 — Token layer.**
Create the three token files. Do not migrate anything yet. Add the dark
theme's semantic overrides. Verify by temporarily setting a token to a
garish value and confirming nothing changes — proving the app does not yet
consume tokens, which is the honest starting point.

**Phase 2 — Base layer migration.**
Migrate `base.css` and `typography.css` onto tokens: every hex, spacing
value, radius, and shadow becomes a `var()`. Add the transition tokens to
buttons, inputs, and cards. Fix focus indicators to one consistent treatment
including `.mobile-bottom-nav`. Replace the global
`input { min-width: 220px }` with width control at the layout level. At the
end of this phase, deleting `theme-dark.css` should leave the base elements
still correct in dark mode.

**Phase 3 — Primitive components.**
Build `src/components/ui/` per section 3.2, with a colocated CSS file per
component. Do not migrate call sites yet. Add unit tests for each primitive
covering variants, disabled state, and accessible name.

**Phase 4 — Call-site migration, one page per commit.**
Order: Dashboard, Transactions, Investments, Wealth, Owed, Categories,
Import, Export, Settings, Privacy. For each page: swap raw elements for
primitives, delete the page's now-redundant CSS, delete that page's entries
from the dark-mode override files, run `npm run test`, `npm run test:e2e`,
`npm run lint`, `npm run build`. Ten commits, each reversible.

**Phase 5 — Dark mode collapse.**
By this point `theme-dark.css`, `theme-dark-overrides.css`, and
`investments-dark.css` should be nearly empty. Delete them. Add a
theme-transition on `background-color` and `color`. Verify every page in
both themes at 375px, 800px, and 1440px.

**Phase 6 — Charts and icons.**
Implement sections 3.4 and 3.5. This is last because charts benefit from the
token and primitive layers already existing.

**Phase 7 — Consistency sweep and guardrails.**
Full pass at three viewports in both themes. Then add the guardrails in
section 5 so the drift cannot recur.

## 5. Guardrails

Without these, the codebase returns to its current state within months.

- **Stylelint** with `declaration-property-value-disallowed-list` banning
  raw hex, `rgb()`, and `hsl()` outside `tokens/primitives.css`. Also ban
  `!important` outside an explicit allowlist.
- **A spacing/radius lint rule** restricting `padding`, `margin`, `gap`, and
  `border-radius` to `var(--space-*)` / `var(--radius-*)`.
- **The existing 1000-line file cap applies to CSS too** — currently
  `index.css` at 854 and `theme-dark.css` at 618 are close to it and are
  exactly the files that should not exist in that form.
- **Wire Stylelint into `.github/workflows/ci.yml`** alongside the existing
  `eslint .` step, as a required check.
- **A short "adding a new component" section in `frontend/README.md`**:
  use a `ui/` primitive, use semantic tokens, never write a
  `[data-theme='dark']` selector.

## 6. Acceptance criteria for "flawless"

The work is complete when all of the following hold:

- `rg '#[0-9a-fA-F]{3,8}' frontend/src --type css` returns matches only in
  `tokens/primitives.css`.
- No file matching `*dark*.css` exists in `src/styles/`.
- Every interactive element has a visible hover, active, focus-visible, and
  disabled state, and all four are defined by a `ui/` primitive.
- Every async surface renders a skeleton at its final height — no layout
  shift between loading and loaded.
- Every empty state uses `EmptyState` with an icon, an explanation, and an
  action.
- Every chart has axes, gridlines, a tooltip, themed colours from tokens,
  and keyboard-reachable interaction.
- Every icon-only button has an `aria-label`.
- `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build`
  all pass, and Stylelint is a required CI check.
- The app is visually verified at 375px, 800px, and 1440px in both themes,
  on every page.
