import { expect, test } from '@playwright/test'

test('imports a Revolut CSV and commits new transactions', async ({ page }) => {
  await page.goto('/import')

  const csvContent = [
    'Completed Date,Description,Amount,Currency',
    `2026-06-09 10:00:00,E2E Test Salary ${Date.now()},1000.00,EUR`,
  ].join('\n')

  await page.getByLabel('File').setInputFiles({
    name: 'revolut.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })

  await page.getByRole('button', { name: 'Preview file' }).click()

  await expect(page.getByRole('heading', { name: 'Preview summary' })).toBeVisible()
  await expect(page.getByText(/^E2E Test Salary \d+$/).first()).toBeVisible()

  await page.getByText(/I reviewed this exact preview/).click()

  const commitButton = page.getByRole('button', { name: /^Commit \d+ rows$/ })
  await expect(commitButton).toBeEnabled()
  await commitButton.click()

  await expect(page.getByText('Import committed.')).toBeVisible()
})
