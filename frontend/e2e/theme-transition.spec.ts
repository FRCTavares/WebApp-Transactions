import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'finance-theme-preference'
const TRANSITION_CLASS = 'theme-transitioning'

async function openThemeControls(page: Page, isMobile: boolean) {
  if (!isMobile) {
    return
  }

  const mobileNavigation = page.getByRole('navigation', {
    name: 'Mobile navigation',
  })

  await mobileNavigation.getByRole('button', { name: 'More' }).click()
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible()
}

function getThemeButton(
  page: Page,
  isMobile: boolean,
  theme: 'Light' | 'Dark',
) {
  if (isMobile) {
    return page.getByRole('radio', { name: theme, exact: true })
  }

  return page.getByRole('button', {
    name: `Use ${theme.toLowerCase()} mode`,
    exact: true,
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(storageKey, 'light')
    },
    { storageKey: THEME_STORAGE_KEY },
  )
})

test('theme changes use a temporary colour transition', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  await openThemeControls(page, isMobile)

  const root = page.locator('html')

  await expect(root).toHaveAttribute('data-theme', 'light')

  const transitionObserved = root.evaluate(
    (element, transitionClass) =>
      new Promise<boolean>((resolve) => {
        if (element.classList.contains(transitionClass)) {
          resolve(true)
          return
        }

        const observer = new MutationObserver(() => {
          if (element.classList.contains(transitionClass)) {
            observer.disconnect()
            resolve(true)
          }
        })

        observer.observe(element, {
          attributes: true,
          attributeFilter: ['class'],
        })

        window.setTimeout(() => {
          observer.disconnect()
          resolve(false)
        }, 1_000)
      }),
    TRANSITION_CLASS,
  )

  await getThemeButton(page, isMobile, 'Dark').click()

  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(transitionObserved).resolves.toBe(true)

  await expect(root).not.toHaveClass(
    new RegExp(`(^|\\s)${TRANSITION_CLASS}(\\s|$)`),
    { timeout: 1_000 },
  )
})

test('reduced motion skips the theme transition', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await openThemeControls(page, isMobile)

  const root = page.locator('html')

  await expect(root).toHaveAttribute('data-theme', 'light')

  await getThemeButton(page, isMobile, 'Dark').click()

  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(root).not.toHaveClass(
    new RegExp(`(^|\\s)${TRANSITION_CLASS}(\\s|$)`),
  )
})
