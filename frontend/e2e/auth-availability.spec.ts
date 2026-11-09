import type { Route } from '@playwright/test'
import { expect, test, type Page } from './test'
import { mockAuth } from './auth-fixture'

const access = `header.${Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url')}.signature`
const csrf = { headerName: 'X-XSRF-TOKEN', token: 'test-csrf' }
const unavailable = '로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.'

async function holdSessionCheck(page: Page) {
  let receive!: (route: Route) => void
  const request = new Promise<Route>(resolve => { receive = resolve })
  await page.route('**/api/auth/csrf', route => { receive(route) }, { times: 1 })
  return { request }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'availability-test', displayName: '음악 친구', email: '',
  } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
})

test('visitors can browse public pages without a login notice when the session service is unavailable', async ({ page }) => {
  const pending = await holdSessionCheck(page)
  await page.goto('/')
  const request = await pending.request
  // Public sections remain available; only personalized hero content waits.
  const home = page.getByText('음악으로 만나는 나의 취향', { exact: true })
  await expect(home).toBeVisible()
  await expect(page.getByText('로그인 정보를 확인하고 있어요.')).toHaveCount(0)

  await request.abort('connectionrefused')
  await page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기' }).click()
  await expect(page).toHaveURL(/\/analyze$/)
  await expect(page.getByText(unavailable)).toBeVisible()

  await page.goBack()
  await expect(home).toBeVisible()
  await expect(page.getByText(unavailable)).toHaveCount(0)
  await page.locator('header').getByRole('link', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
  await expect(page.getByText(unavailable)).toHaveCount(0)
  await page.getByRole('link', { name: /커뮤니티/ }).click()
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  await expect(page.getByText(unavailable)).toHaveCount(0)
})

test('a protected page waits at its original URL without requesting private data before session restoration', async ({ page }) => {
  await mockAuth(page, access)
  const pending = await holdSessionCheck(page)
  const privateRequests: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (['/api/me', '/api/posts', '/api/analysis/latest'].includes(path)) privateRequests.push(path)
  })

  await page.goto('/mypage')
  const request = await pending.request
  await expect(page.getByRole('status', { name: '로그인 정보를 확인하고 있어요.' })).toBeAttached()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page).toHaveURL(/\/mypage$/)
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  expect(privateRequests).toEqual([])

  await request.fulfill({ json: csrf })
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/mypage$/)
  await expect.poll(() => privateRequests).toContain('/api/me')
})

test('OAuth callback waits for restoration before consuming its destination and navigating', async ({ page }) => {
  await mockAuth(page, access)
  const pending = await holdSessionCheck(page)
  const destination = '/community?q=jazz&sort=popular'
  await page.addInitScript(value => sessionStorage.setItem('login-destination', value), destination)

  await page.goto('/oauth/callback')
  const request = await pending.request
  await expect(page.getByText('로그인 정보를 확인하고 있어요.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/oauth\/callback$/)
  expect(await page.evaluate(() => sessionStorage.getItem('login-destination'))).toBe(destination)

  await request.abort('connectionrefused')
  await expect(page.getByText(unavailable)).toBeVisible()
  await expect(page).toHaveURL(/\/oauth\/callback$/)
  await page.getByRole('button', { name: '다시 확인하기' }).click()
  await expect(page).toHaveURL(`http://127.0.0.1:5178${destination}`)
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('login-destination'))).toBeNull()
})
