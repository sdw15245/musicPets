import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { mockAuth } from './auth-fixture'

test('genre explanations expand without changing the saved analysis', async ({ page }, testInfo) => {
  await mockAuth(page, 'test-access')
  let calls = 0
  await page.route('**/api/analysis', route => {
    calls++
    return route.fulfill({ json: {
      id: 'remodel-analysis', analyzedAt: '2026-09-30T00:00:00Z',
      genres: { vector: { pop: .4, indie: .3, jazz: .2, rock: .1 }, trackCount: 10, tagCount: 20, unmappedTags: [] },
      character: { slug: 'mochi', name: '모찌', description: '아늑한 몽상가', imageUrl: '/characters/mochi.png', score: .92 },
      profile: { mainstream: 60, obscurity: 40, comment: '익숙한 멜로디 속에서 나만의 분위기를 발견하는 취향이에요.' },
      recommendations: [{ name: '검증용 추천곡', artist: '테스트 아티스트', uri: 'spotify:track:example123', imageUrl: '' }],
      recommendationsAvailable: true, warnings: [],
    } })
  })
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  const indie = page.locator('summary').filter({ hasText: '인디' })
  await expect(indie).toContainText('30.0%')
  await indie.focus()
  await page.keyboard.press('Enter')
  await expect(indie.locator('..')).toHaveAttribute('open', '')
  await expect(page.getByRole('link', { name: '검증용 추천곡 Spotify에서 듣기' })).toHaveAttribute('href', 'https://open.spotify.com/track/example123')
  expect(calls).toBe(1)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: testInfo.outputPath('result-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.getByRole('banner')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('result-mobile.png'), fullPage: true })
})

test('login explains connection without a second landing or analysis requests', async ({ page }, testInfo) => {
  const analyses: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/analysis') analyses.push(request.method()) })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '나의 음악 펫을 만나보세요' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Spotify로 계속하기' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 360, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(analyses).toEqual([])
})

test('landing navigation reveals content and reduced motion disables decorative animation', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.screenshot({ path: testInfo.outputPath('landing-desktop.png'), fullPage: false })
  await page.screenshot({ path: testInfo.outputPath('landing-desktop-full.png'), fullPage: true })
  await page.getByRole('button', { name: '이용 방법', exact: true }).click()
  await expect(page.getByRole('heading', { name: /듣던 음악으로\s*나의 펫을 찾는 방법/ })).toBeInViewport()
  const flow = page.getByRole('list', { name: '음악 펫을 만나는 과정' })
  await expect(flow.locator(':scope > li')).toHaveCount(3)
  await expect(page.locator('.scroll-intro')).toHaveCount(0)
  expect(await page.locator('.hero-result-preview').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('header').getByRole('link', { name: '로그인', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('landing-mobile.png'), fullPage: false })
  await page.screenshot({ path: testInfo.outputPath('landing-mobile-full.png'), fullPage: true })
})

test('desktop composer keeps actions accessible and closing restores focus', async ({ page }, testInfo) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.goto('/community')
  const trigger = page.getByRole('button', { name: '오늘의 한 곡 올리기' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('composer-desktop.png') })
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
