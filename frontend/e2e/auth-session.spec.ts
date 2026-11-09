import { expect, test, type Page } from './test'
import { mockAuth } from './auth-fixture'

const profile = { id: 1, spotifyId: 'auth-test', displayName: '인증 테스트', email: '' }
const access = `header.${Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url')}.signature`

async function profileApi(page: Page) {
  await page.route('**/api/me', route => route.fulfill({ json: profile }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
}

test('reload restores from HttpOnly cookie, uses memory Bearer and removes old stored credentials', async ({ page, context }) => {
  await context.addCookies([{ name: 'musicpets_refresh', value: 'server-refresh', domain: '127.0.0.1',
    path: '/api/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(() => localStorage.setItem('auth', JSON.stringify({ state: {
    accessToken: 'legacy-access', refreshToken: 'legacy-refresh',
  } })))
  await profileApi(page)
  let restores = 0
  await page.route('**/api/auth/refresh', async route => {
    restores++
    const headers = await route.request().allHeaders()
    expect(headers.cookie).toContain('musicpets_refresh=server-refresh')
    expect(headers['x-xsrf-token']).toBe('test-csrf')
    expect(headers.authorization).toBeUndefined()
    expect(route.request().postData()).toBeNull()
    await route.fulfill({ json: { access } })
  })
  let meCalls = 0
  await page.route('**/api/me', async route => {
    meCalls++
    expect(route.request().headers().authorization).toBe(`Bearer ${access}`)
    expect((await route.request().allHeaders()).cookie ?? '').not.toContain('musicpets_refresh')
    await route.fulfill({ json: profile })
  })
  await page.goto('/mypage')
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: profile.displayName, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: profile.displayName, exact: true })).toBeVisible()
  expect(restores).toBe(2)
  expect(meCalls).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(() => localStorage.getItem('auth'))).toBeNull()
  expect(await page.evaluate(() => document.cookie)).not.toContain('server-refresh')
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(access)
  expect((await context.cookies()).some(cookie => cookie.value === access)).toBe(false)
  expect(page.url()).not.toContain('access=')
})

test('legacy callback query tokens cannot log a guest in and are removed from the URL', async ({ page }) => {
  await page.goto('/oauth/callback?access=untrusted&refresh=untrusted')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('auth'))).toBeNull()
})

test('temporary restoration failure offers retry without treating the session as logged out', async ({ page }) => {
  await profileApi(page)
  let calls = 0
  await page.route('**/api/auth/refresh', route => route.fulfill(++calls === 1
    ? { status: 503, json: { error: 'AUTH_UNAVAILABLE' } } : { json: { access } }))
  await page.goto('/mypage')
  await expect(page.getByText('로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.')).toBeVisible()
  await expect(page).toHaveURL(/\/mypage$/)
  await page.getByRole('button', { name: '다시 확인하기' }).click()
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  expect(calls).toBe(2)
})

test('expired CSRF is fetched again once and retried with the replacement header', async ({ page }) => {
  await profileApi(page)
  let csrfCalls = 0
  let refreshCalls = 0
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: `csrf-${++csrfCalls}` } }))
  await page.route('**/api/auth/refresh', async route => {
    refreshCalls++
    expect(route.request().headers()['x-xsrf-token']).toBe(`csrf-${refreshCalls}`)
    await route.fulfill(refreshCalls === 1 ? { status: 403, json: { error: 'CSRF_INVALID' } } : { json: { access } })
  })
  await page.goto('/mypage')
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '인증 테스트', exact: true })).toBeVisible()
  expect(csrfCalls).toBe(2)
  expect(refreshCalls).toBe(2)
})

test('parallel expired API requests share one refresh and retry with the new Bearer', async ({ page }) => {
  await profileApi(page)
  let refreshCalls = 0
  await page.route('**/api/auth/refresh', async route => {
    refreshCalls++
    if (refreshCalls > 1) await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ json: { access: refreshCalls === 1 ? access : `${access}-renewed` } })
  })
  let expiredCalls = 0
  for (const path of ['me', 'posts?**']) {
    await page.route(`**/api/${path}`, async route => {
      if (route.request().headers().authorization === `Bearer ${access}`) {
        expiredCalls++
        await route.fulfill({ status: 401, json: {} })
      } else await route.fulfill({ json: path === 'me' ? profile : { items: [], page: 0, hasMore: false } })
    })
  }
  await page.goto('/mypage')
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page.getByText('아직 공유한 음악이 없어요', { exact: true })).toBeVisible()
  expect(expiredCalls).toBeGreaterThanOrEqual(2)
  expect(refreshCalls).toBe(2) // Bootstrap plus one shared refresh.
})

test('failed logout keeps the session available, successful retry remains logged out after reload', async ({ page }) => {
  await mockAuth(page, access)
  await profileApi(page)
  let logoutCalls = 0
  await page.route('**/api/auth/logout', async route => {
    logoutCalls++
    expect(route.request().headers()['x-xsrf-token']).toBe('test-csrf')
    expect(route.request().headers().authorization).toBeUndefined()
    if (logoutCalls === 1) await route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } })
    else { await mockAuth(page, null); await route.fulfill({ status: 204 }) }
  })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '프로필' })
  await trigger.click()
  await page.getByRole('menuitem', { name: '로그아웃' }).click()
  await expect(page.getByText('로그아웃하지 못했어요. 다시 시도해주세요.')).toBeVisible()
  await expect(trigger).toBeVisible()
  await trigger.click()
  await page.getByRole('menuitem', { name: '로그아웃' }).click()
  await expect(trigger).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: '프로필' })).toHaveCount(0)
  await page.goto('/mypage')
  await expect(page).toHaveURL(/\/login\?next=/)
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
  expect(logoutCalls).toBe(2)
})

test('a refresh that finishes after logout cannot restore the old login', async ({ page }) => {
  await mockAuth(page, access)
  await profileApi(page)
  let refreshCalls = 0
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/refresh', async route => {
    refreshCalls++
    if (refreshCalls > 1) await pending
    await route.fulfill({ json: { access } })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '프로필' })).toBeVisible()
  // Trigger an API 401 after the header has loaded, while keeping logout usable.
  await page.route('**/api/posts?**', route => route.fulfill({ status: 401, json: {} }))
  await page.getByRole('button', { name: '프로필' }).click()
  await page.getByRole('menuitem', { name: '내 프로필' }).click()
  await expect.poll(() => refreshCalls).toBe(2)
  await page.getByRole('button', { name: '프로필' }).click()
  await page.getByRole('menuitem', { name: '로그아웃' }).click()
  await expect(page.getByRole('button', { name: '프로필' })).toHaveCount(0)
  release()
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
