import { expect, test } from '@playwright/test'

test('downloads a personal data JSON export', async ({ page }) => {
  await page.goto('/export')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON export' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^f-transactions-export-.*\.json$/)

  const path = await download.path()
  expect(path).toBeTruthy()

  await expect(page.getByText(/Export downloaded\. \d+ rows included\./)).toBeVisible()
})
