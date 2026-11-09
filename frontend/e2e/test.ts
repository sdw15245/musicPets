import { test as base } from '@playwright/test'
import { mockAuth } from './auth-fixture'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'
export const test = base.extend<{ authSession: void }>({
  authSession: [async ({ page }, use) => {
    await mockAuth(page, null)
    await page.route('**/api/notifications/unread-count', route => route.fulfill({ json: { count: 0 } }))
    await use()
  }, { auto: true }],
})
