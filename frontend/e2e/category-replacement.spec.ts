import { expect, test } from '@playwright/test'

test('replaces a category with linked transactions and deletes it', async ({ page }, testInfo) => {
  const uniqueSuffix = `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`
  const categoryName = `E2E Category ${uniqueSuffix}`
  const replacementName = `E2E Replacement ${uniqueSuffix}`

  await page.goto('/categories')

  // The replacement dialog needs somewhere to reassign the transactions to.
  // Create that target explicitly rather than relying on categories left
  // behind by earlier runs - against a clean database there are none.
  await page.getByLabel('Name').fill(replacementName)
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByText(replacementName)).toBeVisible()

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

  const replacementSelect = replacementDialog.getByRole('combobox', {
    name: 'Replace with',
  })
  await replacementSelect.selectOption({ label: replacementName })
  await expect(replacementSelect.locator('option:checked')).toHaveText(
    replacementName,
  )

  await replacementDialog.getByRole('button', { name: 'Replace all and delete' }).click()

  await expect(
    page.getByText(`1 transaction was moved to ${replacementName}.`),
  ).toBeVisible()
  await expect(page.getByText(categoryName, { exact: true })).not.toBeVisible()
})
