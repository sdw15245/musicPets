import type { Route } from '@playwright/test'
import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

const access = `header.${Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url')}.signature`
const result = {
  id: 'saved-home', analyzedAt: '2026-11-07T00:00:00Z',
  genres: { vector: { pop: 1 }, unmappedTags: [], tagCount: 1, trackCount: 20 },
  character: { slug: 'pip', name: '핍', description: '', imageUrl: '/characters/pip.png', score: .9 },
  profile: { mainstream: 60, obscurity: 40, comment: '저장된 취향 설명' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await mockAuth(page, access)
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'home-test', displayName: '음악 친구', email: '',
  } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
})

test('home reload never presents guest actions or example pets while restoring a saved result', async ({ page }, info) => {
  const renderingErrors: string[] = []
  page.on('pageerror', error => renderingErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|cannot contain|cannot be a descendant/i.test(message.text())) renderingErrors.push(message.text())
  })
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.abort() })
  await page.goto('/')
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 취향 보기' })).toBeVisible()

  let receiveAuth!: (route: Route) => void
  let receiveResult!: (route: Route) => void
  const auth = new Promise<Route>(resolve => { receiveAuth = resolve })
  const latest = new Promise<Route>(resolve => { receiveResult = resolve })
  await page.route('**/api/auth/refresh', route => { receiveAuth(route) }, { times: 1 })
  await page.route('**/api/analysis/latest', route => { receiveResult(route) }, { times: 1 })
  await page.reload()
  const authRequest = await auth
  await expect(page.locator('.music-hero')).toBeVisible()
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
  await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('home-restoring-session.png') })

  await authRequest.fulfill({ json: { access } })
  const resultRequest = await latest
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: info.outputPath('home-restoring-result-mobile.png') })

  await resultRequest.fulfill({ json: result })
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 취향 보기' })).toBeVisible()
  await expect(page.getByRole('region', { name: '나의 음악 취향 요약' })).toContainText(result.profile.comment)
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  expect(analyses).toBe(0)
  expect(renderingErrors).toEqual([])
})

test('a confirmed guest or member without a result can still start analysis', async ({ page }) => {
  await mockAuth(page, null)
  await page.goto('/')
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 음악 취향 분석하기' })).toBeVisible()
  await expect(page.locator('.hero-footnote')).toContainText('계정 연결이 필요해요')
  await mockAuth(page, access)
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.reload()
  await expect(page.locator('header').getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 음악 취향 분석하기' })).toBeVisible()
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toBeVisible()
})

test('failed result retrieval is not presented as a missing result', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 503, json: {} }))
  await page.goto('/')
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 취향 확인하기' })).toHaveAttribute('href', '/result')
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
})
