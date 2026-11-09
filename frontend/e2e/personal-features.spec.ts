import { expect, test } from './test'
import { signedInPreview, mockPlayers } from './community-fixture'
import { sampleTracks } from './community-data'

const snapshot = (id: string, pop: number) => ({
  id, analyzedAt: id === 'new' ? '2026-11-04T00:00:00Z' : '2026-10-04T00:00:00Z',
  genres: { vector: { pop, rock: 1 - pop }, unmappedTags: [], tagCount: 10, trackCount: 10 },
  character: { slug: 'mochi', name: '모찌', description: '나를 닮은 펫', imageUrl: '/characters/mochi.png', score: 0.8 },
  profile: { mainstream: 50, obscurity: 50, comment: '그날의 음악 취향이에요.' },
  recommendations: [sampleTracks[0]], recommendationsAvailable: true, warnings: [],
})

test('history compares snapshots, opens saved details and confirms deletion', async ({ page }, info) => {
  await signedInPreview(page)
  let rows = [snapshot('new', 0.7), snapshot('old', 0.4)]
  await page.route(/\/api\/analysis\/history(?:\/[^/?]+)?$/, route => {
    const id = new URL(route.request().url()).pathname.split('/')[4]
    if (route.request().method() === 'DELETE') { rows = rows.filter(row => row.id !== id); return route.fulfill({ status: 204 }) }
    return route.fulfill({ json: id ? rows.find(row => row.id === id) : rows })
  })
  await page.goto('/history')
  await expect(page.getByRole('heading', { name: '분석 기록', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '취향 비교하기' }).click()
  await expect(page.getByRole('list', { name: '장르 비중 변화' })).toContainText('30.0%p 증가')
  await page.setViewportSize({ width: 360, height: 850 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('history-comparison-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('link', { name: /기록 자세히 보기/ }).last().click()
  await expect(page).toHaveURL('/history/old')
  await expect(page.getByText('그날의 음악 취향이에요.')).toBeVisible()
  await page.getByRole('link', { name: '분석 기록 목록' }).click()
  await page.getByRole('button', { name: '분석 기록 삭제' }).last().click()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(rows).toHaveLength(2)
  await page.getByRole('button', { name: '분석 기록 삭제' }).last().click()
  await page.getByRole('button', { name: '삭제 확인', exact: true }).click()
  await expect(page.getByRole('link', { name: /기록 자세히 보기/ })).toHaveCount(1)
  await page.setViewportSize({ width: 360, height: 850 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('history-mobile.png'), fullPage: true })
})

test('old library links explain the change without fetching or mutating saved songs', async ({ page }) => {
  await signedInPreview(page)
  const requests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/library')) requests.push(request.method()) })
  await page.goto('/library')
  await expect(page.getByRole('main').getByText('음악 보관함은 더 이상 제공하지 않아요.')).toBeVisible()
  await page.getByRole('link', { name: '내 취향으로 가기' }).click()
  await expect(page).toHaveURL('/result')
  expect(requests).toEqual([])
})

test('notifications mark read, open the related post, and show a recoverable failure', async ({ page }, info) => {
  await signedInPreview(page)
  await mockPlayers(page)
  let read = false
  await page.route('**/api/notifications/unread-count', route => route.fulfill({ json: { count: read ? 0 : 1 } }))
  await page.route(/\/api\/notifications\?.*$/, route => route.fulfill({ json: {
    items: [{ id: '10', actor: '음악 친구', avatarSlug: 'mochi', kind: 'COMMENT', postId: '1', commentId: '1', createdAt: '2026-11-04T00:00:00Z', read }],
    page: 0, hasMore: false, unreadCount: read ? 0 : 1,
  } }))
  await page.route('**/api/notifications/10/read', route => { read = true; return route.fulfill({ status: 204 }) })
  await page.goto('/notifications')
  await expect(page.getByText('읽지 않은 알림 1개', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('notifications-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 360, height: 850 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '읽음으로 표시', exact: true }).click()
  await expect(page.getByText('읽지 않은 알림 0개', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /음악 친구.*댓글/ }).click()
  await expect(page).toHaveURL(/\/community\/posts\/1/)
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /댓글.*개/ })).toHaveAttribute('aria-expanded', 'true')
  await page.route(/\/api\/notifications\?.*$/, route => route.fulfill({ status: 500, json: {} }))
  await page.goto('/notifications')
  await expect(page.getByRole('alert')).toContainText('알림을 불러오지 못했어요.')
  await expect(page.getByText('새로운 알림이 없어요', { exact: true })).toHaveCount(0)
})
