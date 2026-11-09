import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test('personal destinations stay accessible without a crowded account menu or library requests', async ({ page }, info) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [] }))
  await page.route('**/api/notifications?*', route => route.fulfill({ json: { items: [], page: 0, hasMore: false, unreadCount: 0 } }))
  const libraryRequests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/library')) libraryRequests.push(request.url()) })
  await page.goto('/community')
  await expect(page.getByRole('button', { name: /보관하기/ })).toHaveCount(0)
  await page.getByRole('button', { name: '프로필', exact: true }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['내 프로필', '로그아웃'])
  await page.getByRole('menuitem', { name: '내 프로필', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: '메인 메뉴' }).getByRole('link', { name: '내 취향', exact: true }).click()
  await expect(page).toHaveURL('/result')
  await page.getByRole('navigation', { name: '내 취향 메뉴' }).getByRole('link', { name: '분석 기록' }).click()
  await expect(page.getByRole('heading', { name: '아직 분석 기록이 없어요' })).toBeVisible()
  await page.getByRole('link', { name: '만난 펫', exact: true }).click()
  await expect(page.getByRole('heading', { name: '만난 펫', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('pets-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 360, height: 800 })
  await expect(page.getByRole('banner').getByRole('link', { name: '알림', exact: true })).toBeInViewport()
  await page.getByRole('banner').getByRole('link', { name: '알림', exact: true }).click()
  await expect(page.getByRole('heading', { name: '알림', exact: true })).toBeVisible()
  await page.goto('/library')
  await expect(page.getByRole('link', { name: '내 취향으로 가기' })).toHaveAttribute('href', '/result')
  expect(libraryRequests).toEqual([])
})

for (const responseMs of [0, 800, 3000]) test(`analysis reveal waits only for the remainder of 2.5 seconds with a ${responseMs}ms response`, async ({ page }) => {
  await signedInPreview(page)
  const now = new Date('2026-11-07T00:00:00Z')
  // pauseAt must be later than install's running clock, even on a busy machine.
  await page.clock.install({ time: new Date(now.getTime() - 60_000) })
  await page.clock.pauseAt(now)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let received!: () => void
  const requested = new Promise<void>(resolve => { received = resolve })
  await page.route('**/api/analysis', async route => { received(); await pending; await route.fulfill({ json: {
    id: 'immediate', analyzedAt: now.toISOString(),
    genres: { vector: { pop: 1 }, trackCount: 10, tagCount: 10, unmappedTags: [] },
    character: null, profile: { mainstream: 50, obscurity: 50, comment: '테스트 취향 해설' },
    recommendations: [], recommendationsAvailable: true, warnings: [],
  } }) })
  const response = page.waitForResponse('**/api/analysis')
  await page.goto('/analyze')
  await requested
  await page.clock.runFor(responseMs)
  release()
  await response
  if (responseMs < 2500) {
    await page.clock.runFor(2499 - responseMs)
    await expect(page).toHaveURL('/analyze')
    await expect(page.getByRole('heading', { name: '음악 취향을 분석하고 있어요' })).toBeVisible()
    await page.clock.runFor(1)
  }
  // Allow React's Suspense commit; this is not another minimum display time.
  await page.clock.runFor(350)
  await expect(page).toHaveURL('/result')
  await expect(page.getByText('테스트 취향 해설', { exact: true })).toBeVisible()
})
