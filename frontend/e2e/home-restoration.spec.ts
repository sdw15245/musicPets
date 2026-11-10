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
  await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
  await expect(page.locator('.music-hero-copy > p').first()).toContainText('최근 분석한 음악 취향')
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 취향 보기', exact: true })).toHaveAttribute('href', '/result')
  await expect(page.locator('.cta-section h2')).toContainText('나의 펫을 다시 만나보세요')
  await expect(page.locator('.cta-section').getByRole('link', { name: '내 취향 보기', exact: true })).toHaveAttribute('href', '/result')
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
  await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('home-restoring-session.png') })

  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
  await authRequest.fulfill({ json: { access } })
  const resultRequest = await latest
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
  await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
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

for (const member of [false, true]) {
  test(`home action during session restoration is safe for member=${member}`, async ({ page }) => {
    await mockAuth(page, member ? access : null)
    let receive!: (route: Route) => void
    const csrf = new Promise<Route>(resolve => { receive = resolve })
    await page.route('**/api/auth/csrf', route => { receive(route) }, { times: 1 })
    let analyses = 0
    await page.route('**/api/analysis', route => { analyses++; return route.abort() })
    let privateRequests = 0
    page.on('request', request => { if (request.url().endsWith('/api/analysis/latest')) privateRequests++ })
    await page.goto('/')
    const request = await csrf
    await page.locator('.music-hero-actions').getByRole('link', { name: '내 취향 확인하기' }).click()
    await expect(page).toHaveURL(/\/result$/)
    expect(privateRequests).toBe(0)
    await request.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'test-csrf' } })
    if (member) {
      await expect(page.getByRole('heading', { level: 1, name: '내 취향', exact: true })).toBeVisible()
      await expect(page.getByText(result.profile.comment, { exact: true })).toBeVisible()
    } else {
      await expect(page).toHaveURL(/\/login\?next=%2Fresult$/)
    }
    expect(analyses).toBe(0)
  })
}


test('guest reload keeps its copy, action, footnote and examples while auth is pending', async ({ page }) => {
  await mockAuth(page, null)
  await page.goto('/')
  await expect(page.locator('.hero-footnote')).toHaveText('Spotify 계정 연결이 필요해요.')
  const copy = await page.locator('.music-hero-copy').innerText()
  let receive!: (route: Route) => void
  const auth = new Promise<Route>(resolve => { receive = resolve })
  await page.route('**/api/auth/refresh', route => { receive(route) }, { times: 1 })
  await page.reload()
  const request = await auth
  await expect(page.locator('.music-hero-copy')).toHaveText(copy.replace(/\s+/g, ' '), { useInnerText: true })
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toBeVisible()
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기' })).toHaveAttribute('href', '/result')
  await request.fulfill({ status: 401 })
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기' })).toHaveAttribute('href', '/analyze')
})


test('the tab remembers only generic view selection and clears it on logout away from home', async ({ page }) => {
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
  await page.goto('/')
  await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
  const remembered = await page.evaluate(() => JSON.parse(sessionStorage.getItem('musicpets-home-view-v1')!))
  expect(Object.keys(remembered).sort()).toEqual(['kind', 'savedAt', 'userId'])
  expect(remembered).toMatchObject({ kind: 'result', userId: '1' })
  await page.getByRole('link', { name: '커뮤니티', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  await page.getByRole('button', { name: '프로필', exact: true }).click()
  await page.getByRole('menuitem', { name: '로그아웃', exact: true }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('musicpets-home-view-v1')!))).toMatchObject({ kind: 'guest', userId: null })
  await page.goto('/')
  await expect(page.locator('.hero-footnote')).toHaveText('Spotify 계정 연결이 필요해요.')
  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
})

test('switching accounts discards the previous account view before fetching its result', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
  const other = `header.${Buffer.from(JSON.stringify({ sub: '2' })).toString('base64url')}.signature`
  await mockAuth(page, other)
  let receive!: (route: Route) => void
  const latest = new Promise<Route>(resolve => { receive = resolve })
  await page.route('**/api/analysis/latest', route => { receive(route) }, { times: 1 })
  await page.reload()
  const request = await latest
  await expect(page.locator('.music-hero h1')).not.toContainText('음악으로 발견한')
  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 취향 확인하기' })).toHaveAttribute('href', '/result')
  await request.fulfill({ status: 204 })
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기' })).toHaveAttribute('href', '/analyze')
})

for (const saved of ['expired', 'malformed', 'future']) {
  test(`an ${saved} view hint cannot suppress session restoration`, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
    await page.evaluate(saved => sessionStorage.setItem('musicpets-home-view-v1', saved === 'malformed' ? '{' : JSON.stringify({
      kind: 'result', userId: '1', savedAt: Date.now() + (saved === 'expired' ? -31 : 31) * 60_000,
    })), saved)
    let receive!: (route: Route) => void
    const auth = new Promise<Route>(resolve => { receive = resolve })
    await page.route('**/api/auth/refresh', route => { receive(route) }, { times: 1 })
    await page.reload()
    const request = await auth
    await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 취향 확인하기' })).toBeVisible()
    await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
    await request.fulfill({ status: 401 })
    await expect(page.locator('.hero-footnote')).toHaveText('Spotify 계정 연결이 필요해요.')
  })
}

test('a failed session check displays an error instead of guest examples or saved result data', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.music-hero h1')).toContainText('음악으로 발견한')
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 503 }))
  await page.reload()
  await expect(page.locator('.hero-footnote')).toContainText('로그인 상태를 확인하지 못했어요')
  await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toHaveCount(0)
  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
})

test('blocked browser storage still renders the verified server result', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled') }
    Storage.prototype.setItem = () => { throw new Error('Storage disabled') }
    Storage.prototype.removeItem = () => { throw new Error('Storage disabled') }
  })
  await page.goto('/')
  await expect(page.getByRole('region', { name: '나의 음악 취향 요약' })).toContainText(result.profile.comment)
})
