import { expect, test, type Page } from './test'
import { mockAuth } from './auth-fixture'

const result = {
  id: 'login-analysis', analyzedAt: '2026-10-29T00:00:00Z',
  genres: { vector: { pop: 1 }, unmappedTags: [], tagCount: 1, trackCount: 1 },
  character: { slug: 'pip', name: '루바', description: '신난 장난꾸러기', imageUrl: '/characters/pip.png', score: 0.9 },
  profile: { mainstream: 50, obscurity: 50, comment: '음악 취향' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'login-test', displayName: '음악 친구', email: '',
  } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
  await page.route('**/oauth2/authorization/spotify', route => route.fulfill({
    contentType: 'text/html', body: 'Spotify OAuth test',
  }))
})

async function completeLogin(page: Page) {
  await page.getByRole('button', { name: /Spotify로 계속하기/ }).click()
  await expect(page).toHaveURL(/\/oauth2\/authorization\/spotify$/)
  await mockAuth(page, 'login-access')
  await page.goto('/oauth/callback')
}

for (const hasSavedResult of [false, true]) {
  test(`plain login returns home without analyzing when saved result is ${hasSavedResult}`, async ({ page }) => {
    if (hasSavedResult) await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
    let analyses = 0
    await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
    await page.goto('/login')
    // An unrelated login must replace an abandoned analysis destination.
    await page.evaluate(() => sessionStorage.setItem('login-destination', '/analyze'))
    await completeLogin(page)
    await expect(page).toHaveURL('http://127.0.0.1:5178/')
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
    await expect(page.locator('header').getByRole('link', { name: '로그인', exact: true })).toHaveCount(0)
    await expect(page.locator('header').getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
    const cta = page.locator('.music-hero-actions').getByRole('link', {
      name: hasSavedResult ? '내 취향 보기' : '내 음악 취향 분석하기', exact: true,
    })
    await expect(cta).toHaveAttribute('href', hasSavedResult ? '/result' : '/analyze')
    if (hasSavedResult) {
      await cta.click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 취향')
    }
    expect(analyses).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('login-destination'))).toBeNull()
  })
}

for (const { entry, label, loginPath } of [
  { entry: 'header', label: '로그인', loginPath: '/login' },
  { entry: '.music-hero-actions', label: '내 음악 취향 분석하기', loginPath: '/login?next=%2Fanalyze' },
]) {
  test(`guest entry from ${entry} waits for an analysis click after login`, async ({ page }, info) => {
    let analyses = 0
    await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
    await page.goto('/')
    await expect(page.locator('header').getByRole('link', { name: '로그인', exact: true })).toHaveAttribute('href', '/login')
    await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveAttribute('href', '/analyze')
    await page.locator(entry).getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(`http://127.0.0.1:5178${loginPath}`)
    await completeLogin(page)
    await expect(page).toHaveURL('http://127.0.0.1:5178/')
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
    await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toBeVisible()
    await expect(page.getByText('음악 취향을 분석하고 있어요…', { exact: true })).toHaveCount(0)
    expect(analyses).toBe(0)
    await page.screenshot({ path: info.outputPath('login-complete-before-analysis.png') })
    await page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기', exact: true }).click()
    await expect(page).toHaveURL(/\/result$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 취향')
    expect(analyses).toBe(1)
  })
}

test('community login preserves search and sorting without analyzing', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
  const destination = '/community?q=jazz&sort=popular'
  await page.goto(`/login?next=${encodeURIComponent(destination)}`)
  await completeLogin(page)
  await expect(page).toHaveURL(`http://127.0.0.1:5178${destination}`)
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  expect(analyses).toBe(0)
})

test('OAuth retry from an analysis entry returns home without starting analysis', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
  await page.goto('/login?next=%2Fanalyze')
  await page.getByRole('button', { name: /Spotify로 계속하기/ }).click()
  await expect(page).toHaveURL(/\/oauth2\/authorization\/spotify$/)
  await page.goto('/login?oauthError=spotify')
  await completeLogin(page)
  await expect(page).toHaveURL('http://127.0.0.1:5178/')
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  expect(analyses).toBe(0)
})

test('a legacy analysis destination cannot start analysis on the OAuth callback', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
  await page.goto('/login')
  await page.evaluate(() => sessionStorage.setItem('login-destination', '/analyze'))
  await mockAuth(page, 'login-access')
  await page.goto('/oauth/callback')
  await expect(page).toHaveURL('http://127.0.0.1:5178/')
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  expect(analyses).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('login-destination'))).toBeNull()
})

test('returning to a missing result does not start an analysis', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
  await page.goto('/login?next=%2Fresult')
  await completeLogin(page)
  await expect(page).toHaveURL('http://127.0.0.1:5178/result')
  await expect(page.getByRole('heading', { name: '아직 분석한 취향이 없어요' })).toBeVisible()
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  expect(analyses).toBe(0)
})
