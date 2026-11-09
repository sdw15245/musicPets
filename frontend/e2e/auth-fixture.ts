import type { Page } from '@playwright/test'

const sessions = new WeakMap<Page, { access: string | null }>()

/** Model a server-held refresh session, not a browser-readable stored token. */
export async function mockAuth(page: Page, access: string | null) {
  const existing = sessions.get(page)
  if (existing) { existing.access = access; return }
  const session = { access }
  sessions.set(page, session)
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'test-csrf' } }))
  await page.route('**/api/auth/refresh', route => session.access
    ? route.fulfill({ json: { access: session.access } })
    : route.fulfill({ status: 401, json: { error: 'SESSION_EXPIRED' } }))
  await page.route('**/api/auth/logout', route => {
    session.access = null
    return route.fulfill({ status: 204 })
  })
}
