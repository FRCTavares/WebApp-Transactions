import { expect, test } from '@playwright/test'

/**
 * Seeds a small, realistic dataset once before the coverage suites run, so
 * every page renders its populated state (not the empty state a fresh
 * throwaway e2e database starts in). Runs as its own Playwright project
 * (see playwright.config.ts) that every other project depends on.
 *
 * Uses the same UI flows real users (and the rest of the e2e suite) go
 * through - no direct API calls - so this also exercises the create forms
 * it depends on. Entities without a real "add" UI flow (investment
 * holdings/positions, which are derived from transactions and import
 * events, not created directly) are intentionally not seeded here.
 */

const runId = `${Date.now()}`
const groceriesCategory = `E2E Seed Groceries ${runId}`
const utilitiesCategory = `E2E Seed Utilities ${runId}`
const salaryCategory = `E2E Seed Salary ${runId}`
const owedPerson = `E2E Seed Person ${runId}`
const wealthAccountName = `E2E Seed Account ${runId}`

test('seeds representative categories, transactions, owed, and wealth data', async ({ page }) => {
  await page.goto('/categories')

  await page.getByLabel('Name').fill(groceriesCategory)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(groceriesCategory)).toBeVisible()

  await page.getByLabel('Name').fill(utilitiesCategory)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(utilitiesCategory)).toBeVisible()

  await page.getByLabel('Name').fill(salaryCategory)
  await page.getByLabel('Used for').selectOption({ label: 'Money In' })
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(salaryCategory)).toBeVisible()

  await page.goto('/transactions')

  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByLabel('Amount').fill('45.00')
  await page.getByLabel('Description').fill(`E2E seed groceries ${runId}`)
  await page.getByPlaceholder('Category').fill(groceriesCategory)
  await page.getByRole('option', { name: groceriesCategory, exact: true }).click()
  await page.getByRole('button', { name: /^Save Money Out$/ }).click()
  await expect(page.getByText('Transaction created.')).toBeVisible()

  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByLabel('Amount').fill('65.00')
  await page.getByLabel('Description').fill(`E2E seed utilities ${runId}`)
  await page.getByPlaceholder('Category').fill(utilitiesCategory)
  await page.getByRole('option', { name: utilitiesCategory, exact: true }).click()
  await page.getByRole('button', { name: /^Save Money Out$/ }).click()
  await expect(page.getByText('Transaction created.')).toBeVisible()

  await page.getByRole('radio', { name: 'Money In', exact: true }).click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByLabel('Amount').fill('1200.00')
  await page.getByLabel('Description').fill(`E2E seed salary ${runId}`)
  await page.getByPlaceholder('Category').fill(salaryCategory)
  await page.getByRole('option', { name: salaryCategory, exact: true }).click()
  await page.getByRole('button', { name: /^Save Money In$/ }).click()
  await expect(page.getByText('Transaction created.')).toBeVisible()

  await page.goto('/owed')

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Person owing').fill(owedPerson)
  await page.getByLabel('Description', { exact: true }).fill(`E2E seed owed item ${runId}`)
  await page.getByLabel('Total amount').fill('120.00')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Owed item created.')).toBeVisible()

  await page.goto('/wealth')

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByLabel('Name').fill(wealthAccountName)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Wealth account created.')).toBeVisible()

  await page.getByRole('button', { name: 'Snapshot', exact: true }).click()
  await page.getByLabel('Account').selectOption({ label: `${wealthAccountName} (EUR)` })
  await page.getByLabel('Balance').fill('5000.00')
  await page.getByRole('button', { name: 'Create snapshot' }).click()
  await expect(page.getByText('Wealth snapshot created.')).toBeVisible()
})
