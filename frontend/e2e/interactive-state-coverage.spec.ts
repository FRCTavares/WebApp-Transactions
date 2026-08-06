import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'finance-theme-preference'

type Theme = 'light' | 'dark'

type ViewportCase = {
  name: string
  width: number
  height: number
}

const VIEWPORTS: Record<'mobile' | 'tablet' | 'desktop', ViewportCase> = {
  mobile: { name: 'mobile', width: 375, height: 900 },
  tablet: { name: 'tablet', width: 800, height: 1000 },
  desktop: { name: 'desktop', width: 1440, height: 1000 },
}

type Combo = { theme: Theme; viewport: ViewportCase }

/**
 * Full theme x viewport matrix, for pages where the interactive state is
 * high-traffic on both mobile and desktop (primary create flows).
 */
const FULL_MATRIX: Combo[] = (['light', 'dark'] as Theme[]).flatMap((theme) =>
  Object.values(VIEWPORTS).map((viewport) => ({ theme, viewport })),
)

/**
 * Reduced matrix for secondary interactive states: both themes at desktop,
 * plus the light theme across every viewport - so every viewport and every
 * theme is exercised at least once per page, without a full combinatorial
 * explosion.
 */
const REDUCED_MATRIX: Combo[] = [
  { theme: 'light', viewport: VIEWPORTS.mobile },
  { theme: 'light', viewport: VIEWPORTS.tablet },
  { theme: 'light', viewport: VIEWPORTS.desktop },
  { theme: 'dark', viewport: VIEWPORTS.desktop },
]

async function installThemePreference(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ storageKey, themePreference }) => {
      window.localStorage.setItem(storageKey, themePreference)
    },
    { storageKey: THEME_STORAGE_KEY, themePreference: theme },
  )
}

async function getHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const documentElement = document.documentElement
    const body = document.body

    return {
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
    }
  })
}

async function assertNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await getHorizontalOverflow(page)

  expect(overflow.documentScrollWidth, `document overflow ${context}`).toBeLessThanOrEqual(
    overflow.documentClientWidth,
  )
  expect(overflow.bodyScrollWidth, `body overflow ${context}`).toBeLessThanOrEqual(
    overflow.bodyClientWidth,
  )
}

async function setUpPage(page: Page, combo: Combo) {
  await page.setViewportSize({ width: combo.viewport.width, height: combo.viewport.height })
  await installThemePreference(page, combo.theme)
}

function screenshotName(page: string, combo: Combo, state: string) {
  return `${page}-${combo.theme}-${combo.viewport.name}-${combo.viewport.width}px-${state}.png`
}

/**
 * Transactions: the "+ Add" button opens the inline create form.
 * Verified against frontend/src/components/transactions/TransactionsPageView.tsx:162-176
 * (button toggles between "+ Add" and "Close") and
 * frontend/src/components/TransactionForm.tsx:53 (`<h2>{title}</h2>`, title
 * is "Add Money Out" for the default "out" direction, set in
 * TransactionsPageView.tsx:198).
 */
for (const combo of FULL_MATRIX) {
  test(
    `transactions: "+ Add" opens the create form in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/transactions')

      await page.getByRole('button', { name: '+ Add' }).click()

      await expect(
        page.getByRole('heading', { level: 2, name: 'Add Money Out' }),
      ).toBeVisible()
      await expect(page.getByLabel('Amount')).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /transactions with the create form open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('transactions', combo, 'add-transaction-open')),
        fullPage: true,
      })
    },
  )
}

/**
 * Owed: the "Add" button opens the inline owed-item create form.
 * Verified against frontend/src/pages/OwedPage.tsx:487-498 (button toggles
 * between "Add" and "Close") and
 * frontend/src/components/owed/OwedInlineForm.tsx:60-68 (aria-label
 * "Person owing" on the create form's person field).
 */
for (const combo of FULL_MATRIX) {
  test(
    `owed: "Add" opens the inline create form in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/owed')

      await page.getByRole('button', { name: 'Add', exact: true }).click()

      await expect(page.getByLabel('Person owing')).toBeVisible()
      await expect(page.getByLabel('Total amount')).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /owed with the create form open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('owed', combo, 'add-owed-item-open')),
        fullPage: true,
      })
    },
  )
}

/**
 * Wealth: the "Account" button opens the add-account form.
 * Verified against frontend/src/pages/WealthPage.tsx:531-542 (button toggles
 * between "Account" and "Close account") and
 * frontend/src/components/wealth/WealthAccountFormPanel.tsx:30
 * (`<h2>{isEditing ? 'Edit wealth account' : 'Add wealth account'}</h2>`).
 */
for (const combo of FULL_MATRIX) {
  test(
    `wealth: "Account" opens the add-account form in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/wealth')

      await page.getByRole('button', { name: 'Account', exact: true }).click()

      await expect(
        page.getByRole('heading', { level: 2, name: 'Add wealth account' }),
      ).toBeVisible()
      await expect(page.getByLabel('Name')).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /wealth with the add-account form open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('wealth', combo, 'add-account-open')),
        fullPage: true,
      })
    },
  )
}

/**
 * Investments: no coverage in this file. The page previously carried
 * several disclosures (funding split, manual market price entry, detailed
 * positions, filters, events list) that were permanently hidden via CSS as
 * dead UI ("Investments main-view cleanup" in the old investments.css); that
 * dead code was removed outright rather than kept hidden. The page's
 * remaining openable state is the "Add trade"/"Add manual position" modal,
 * which is not yet covered here - see TODO_LIST.md.
 */

/**
 * Categories: deleting a category with linked transactions opens the
 * replacement dialog. Same flow as e2e/category-replacement.spec.ts,
 * verified against
 * frontend/src/components/categories/CategoryReplacementDialog.tsx:69-78
 * (role="dialog", aria-labelledby pointing at a heading reading
 * `Replace "{category.name}"` with curly quotes).
 */
for (const combo of REDUCED_MATRIX) {
  test(
    `categories: deleting a linked category opens the replacement dialog in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)

      const uniqueSuffix = `${testInfo.project.name}-${combo.theme}-${combo.viewport.name}-${Date.now()}`
      const categoryName = `E2E Interactive Category ${uniqueSuffix}`
      const replacementName = `E2E Interactive Replacement ${uniqueSuffix}`

      await page.goto('/categories')

      await page.getByLabel('Name').fill(replacementName)
      await page.getByRole('button', { name: 'Add category' }).click()
      await expect(page.getByText(replacementName)).toBeVisible()

      await page.getByLabel('Name').fill(categoryName)
      await page.getByRole('button', { name: 'Add category' }).click()
      await expect(page.getByText(categoryName)).toBeVisible()

      await page.goto('/transactions')
      await page.getByRole('button', { name: '+ Add' }).click()
      await page.getByLabel('Amount').fill('9.99')
      await page.getByLabel('Description').fill(`E2E interactive linked transaction ${Date.now()}`)
      await page.getByPlaceholder('Category').fill(categoryName)
      await page.getByRole('option', { name: categoryName, exact: true }).click()
      await page.getByRole('button', { name: /^Save Money Out$/ }).click()
      await expect(page.getByText('Transaction created.')).toBeVisible()

      await page.goto('/categories')
      const categoryRow = page.locator('article').filter({ hasText: categoryName })
      await categoryRow.getByRole('button', { name: 'Delete' }).click()

      const replacementDialog = page.getByRole('dialog', { name: `Replace “${categoryName}”` })
      await expect(replacementDialog).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /categories with the replacement dialog open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('categories', combo, 'replace-dialog-open')),
        fullPage: true,
      })

      await replacementDialog.getByRole('button', { name: 'Cancel' }).click()
    },
  )
}

/**
 * Settings: the "Delete account" row expands the account-deletion
 * confirmation panel. Verified against
 * frontend/src/pages/SettingsPage.tsx:189-213 (button with
 * aria-expanded/aria-controls="account-deletion-panel", panel contains a
 * "Confirmation email" field). Targeted via aria-controls rather than
 * getByRole name - the trigger's accessible name is composed from its own
 * "Delete account" heading plus its description and state label ("Delete"/
 * "Cancel"), and once the panel is open a second, separate "Permanently
 * delete account" button also matches a name-based "Delete account" search,
 * causing a strict-mode violation (confirmed against a real run).
 */
for (const combo of REDUCED_MATRIX) {
  test(
    `settings: "Delete account" opens the deletion confirmation panel in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/settings')

      const deleteTrigger = page.locator('button[aria-controls="account-deletion-panel"]')
      await deleteTrigger.click()

      await expect(deleteTrigger).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByLabel('Confirmation email')).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /settings with the deletion panel open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('settings', combo, 'delete-account-open')),
        fullPage: true,
      })
    },
  )
}

/**
 * Import: previewing an uploaded file opens the preview summary. Same flow
 * as e2e/import.spec.ts, verified against
 * frontend/src/pages/ImportPage.tsx:417-421
 * (`{preview && (<section ...><h2>Preview summary</h2>`).
 */
for (const combo of REDUCED_MATRIX) {
  test(
    `import: "Preview file" opens the preview summary in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/import')

      const csvContent = [
        'Completed Date,Description,Amount,Currency',
        `2026-06-09 10:00:00,E2E Interactive Preview ${Date.now()},1000.00,EUR`,
      ].join('\n')

      await page.getByLabel('File').setInputFiles({
        name: 'revolut.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      })

      await page.getByRole('button', { name: 'Preview file' }).click()

      await expect(page.getByRole('heading', { name: 'Preview summary' })).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /import with the preview summary open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('import', combo, 'preview-summary-open')),
        fullPage: true,
      })
    },
  )
}

/**
 * Dashboard: clicking a spending-category legend row opens that category's
 * detail panel. Depends on the seeded "E2E Seed Groceries" expense category
 * and its linked transaction (see e2e/seed.setup.ts). Verified against
 * frontend/src/components/dashboard/ExpenseCategoryDonutChart.tsx:194-220
 * (legend rows are buttons calling onSelectCategory) and
 * frontend/src/pages/DashboardPage.tsx:733-743
 * (`<h3>{selectedCategory} details</h3>`).
 */
for (const combo of REDUCED_MATRIX) {
  test(
    `dashboard: selecting a spending category opens its detail panel in ${combo.theme} theme at ${combo.viewport.width}px`,
    async ({ page }, testInfo) => {
      await setUpPage(page, combo)
      await page.goto('/dashboard')

      const legendRow = page.getByRole('button', { name: /E2E Seed Groceries/ })
      await expect(legendRow).toBeVisible()
      await legendRow.click()

      await expect(
        page.getByRole('heading', { level: 3, name: /E2E Seed Groceries.* details/ }),
      ).toBeVisible()

      await assertNoHorizontalOverflow(page, 'on /dashboard with a category detail panel open')

      await page.screenshot({
        path: testInfo.outputPath(screenshotName('dashboard', combo, 'category-detail-open')),
        fullPage: true,
      })
    },
  )
}
