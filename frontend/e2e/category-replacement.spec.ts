import { expect, test } from '@playwright/test'

test('replaces a category with linked transactions and deletes it', async ({ page }) => {
  const categoryName = `E2E Category ${Date.now()}`

  await page.goto('/categories')
  await page.getByLabel('Name').fill(categoryName)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(categoryName)).toBeVisible()

  await page.goto('/transactions')
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByLabel('Amount').fill('9.99')
  await page.getByLabel('Description').fill(`E2E linked transaction ${Date.now()}`)

  const categoryCombobox = page.getByPlaceholder('Category')
  await categoryCombobox.fill(categoryName)
  await page.getByRole('option', { name: categoryName, exact: true }).click()

  await page.getByRole('button', { name: /^Save Money Out$/ }).click()
  await expect(page.getByText('Transaction created.')).toBeVisible()

  await page.goto('/categories')
  const categoryRow = page.locator('article').filter({ hasText: categoryName })
  await categoryRow.getByRole('button', { name: 'Delete' }).click()

  const replacementDialog = page.getByRole('dialog', { name: `Replace “${categoryName}”` })
  await expect(replacementDialog).toBeVisible()
  await expect(replacementDialog.getByText('1 linked transaction')).toBeVisible()

  await replacementDialog.getByRole('button', { name: 'Replace all and delete' }).click()

  await expect(page.getByText(/transaction was moved to/)).toBeVisible()
  await expect(page.getByText(categoryName, { exact: true })).not.toBeVisible()
})
