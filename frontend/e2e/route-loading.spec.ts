import { expect, test, type Page } from './test'
import type { Route } from '@playwright/test'
import { mockAuth } from './auth-fixture'

// Match both Vite's development modules and the production route chunk.
const communityModule = /\/(?:src\/features\/community\/CommunityPage\.tsx|assets\/CommunityPage-[^/]+\.js)(?:\?.*)?$/
const myPageModule = /\/(?:src\/features\/mypage\/MyPage\.tsx|assets\/MyPage-[^/]+\.js)(?:\?.*)?$/
const communityHeading = (page: Page) => page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })

test.beforeEach(async ({ page }) => {
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
})

test('the home page defers community code until navigation requests it', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (communityModule.test(request.url())) requests.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /좋아하는 음악 속에/ })).toBeVisible()
  expect(requests).toHaveLength(0)

  await page.getByRole('banner').getByRole('link', { name: '커뮤니티', exact: true }).click()
  await expect(communityHeading(page)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '본문 또는 태그 검색' })).toBeVisible()
  expect(requests).toHaveLength(1)
})

test('a direct visit shows loading feedback while its page module is downloading', async ({ page }, info) => {
  let receive!: (route: Route) => void
  const pending = new Promise<Route>(resolve => { receive = resolve })
  await page.route(communityModule, route => { receive(route) })
  await page.goto('/community', { waitUntil: 'domcontentloaded' })
  const request = await pending
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(communityHeading(page)).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('화면을 불러오고 있어요.')
  await page.screenshot({ path: info.outputPath('route-loading.png') })
  await request.continue()
  await expect(page.getByRole('textbox', { name: '본문 또는 태그 검색' })).toBeVisible()
})

test('a failed page download offers a reload that recovers after connectivity returns', async ({ page }, info) => {
  await page.route(communityModule, route => route.abort())
  await page.goto('/community')
  await expect(page.getByRole('alert')).toContainText('화면을 불러오지 못했어요.')
  await page.screenshot({ path: info.outputPath('route-download-error.png') })
  await page.unroute(communityModule)
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.getByRole('button', { name: '새로고침', exact: true }).click(),
  ])
  await expect(page.getByRole('textbox', { name: '본문 또는 태그 검색' })).toBeVisible({ timeout: 15000 })
})

test('signed-out visitors do not download the protected page module', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (myPageModule.test(request.url())) requests.push(request.url()) })
  await page.goto('/mypage')
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
  await expect(page).toHaveURL(/\/login\?next=%2Fmypage$/)
  expect(requests).toHaveLength(0)
})

test('the temporary header does not fetch account data while a page module is held', async ({ page }) => {
  await mockAuth(page, 'preview-access')
  const calls: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (['/api/me', '/api/notifications/unread-count'].includes(path)) calls.push(path)
  })
  let receive!: (route: Route) => void
  const held = new Promise<Route>(resolve => { receive = resolve })
  await page.route(myPageModule, route => receive(route))
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'test', displayName: '음악 친구', email: '' } }))
  await page.goto('/mypage')
  const module = await held
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: '화면을 불러오고 있어요.' })).toBeAttached()
  expect(calls).toEqual([])
  await module.continue()
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  await expect.poll(() => calls).toContain('/api/me')
})
