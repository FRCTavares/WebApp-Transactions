import { expect, test } from '@playwright/test'

test('authenticated user lands on the dashboard', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible()
})

test('desktop sidebar navigation reaches the main screens', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only sidebar; see mobile bottom nav test below')
  await page.goto('/')

  await page.getByRole('button', { name: 'Transactions' }).first().click()
  await expect(page).toHaveURL(/\/transactions$/)

  await page.getByRole('button', { name: 'Owed' }).first().click()
  await expect(page).toHaveURL(/\/owed$/)
})

test('mobile bottom navigation reaches the main screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only bottom nav; see desktop sidebar test above')
  await page.goto('/')

  const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' })

  await bottomNav.getByRole('button', { name: 'Activity' }).click()
  await expect(page).toHaveURL(/\/transactions$/)

  await bottomNav.getByRole('button', { name: 'Owed' }).click()
  await expect(page).toHaveURL(/\/owed$/)
})
