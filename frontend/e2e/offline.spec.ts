import { expect, test } from '@playwright/test'

test('shows cached data and an offline notice when the network is unavailable', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright's WebKit driver has long-standing, widely-reported flakiness
  // navigating a page while context.setOffline(true) is active (unrelated to
  // this app's service worker); see e.g. microsoft/playwright#23899,
  // #27337, #31558. Real Safari supports service workers and offline
  // caching normally - this is a driver limitation, not a product one. See
  // docs/browser-support.md for the manual-verification caveat this implies.
  test.skip(browserName === 'webkit', 'Playwright WebKit driver limitation, see comment above')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

  // Wait for the service worker to be active, then reload so this visit's
  // navigation and API requests are actually served (and cached) through it.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByText("You're offline")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

  await context.setOffline(false)
})
