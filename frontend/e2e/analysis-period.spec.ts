import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const record = {
  id: 'four-weeks', analyzedAt: '2026-11-07T00:00:00Z',
  genres: { vector: { pop: .6, indie: .4 }, trackCount: 20, tagCount: 30, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'mochi', name: '멜로', description: '아늑한 몽상가', imageUrl: '/characters/mochi.png', score: .9 },
  profile: null, profilePending: true, recommendations: [], recommendationsPending: true,
  recommendationsAvailable: false, warnings: [],
}

test('recent period is visible and sharing works while recommendations are still pending', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: record }))
  await page.route('**/api/analysis/four-weeks/**', route => route.fulfill({ status: 503, json: { message: 'later' } }))
  await page.goto('/result')
  await expect(page.getByText('최근 4주 · 20곡 분석', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드' })
  await expect(dialog.getByRole('img', { name: /최근 4주/ })).toBeVisible()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'PNG 저장하기' }).click()
  await (await download).saveAs(info.outputPath('four-week-share.png'))
  await page.keyboard.press('Escape')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: info.outputPath(`period-result-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('older results retain six months and mixed-period comparison explains the difference', async ({ page }) => {
  await signedInPreview(page)
  const legacy = { ...record, id: 'old', analyzedAt: '2026-11-01T00:00:00Z',
    genres: { vector: { pop: .2, indie: .8 }, trackCount: 10, tagCount: 10, unmappedTags: [] }, profilePending: false, recommendationsPending: false }
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: legacy }))
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [record, legacy] }))
  await page.goto('/result')
  await expect(page.getByText('최근 6개월 · 10곡 분석', { exact: true })).toBeVisible()
  await page.goto('/history')
  await page.getByRole('button', { name: '취향 비교하기' }).click()
  await expect(page.getByText('두 기록의 분석 기간이 달라요. 기간 차이도 결과에 영향을 줄 수 있어요.')).toBeVisible()
})

test('six-month fallback retains its period in current, historical and shared results', async ({ page }) => {
  await signedInPreview(page)
  const notice = '최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.'
  const fallback = { ...record, id: 'fallback', genres: { ...record.genres, timeRange: 'medium_term' },
    profilePending: false, recommendationsPending: false, warnings: [notice] }
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: fallback }))
  await page.route('**/api/analysis/history/fallback', route => route.fulfill({ json: fallback }))
  for (const path of ['/result', '/history/fallback']) {
    await page.goto(path)
    await expect(page.getByText('최근 6개월 · 20곡 분석', { exact: true })).toBeVisible()
    await expect(page.getByText(notice, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '음악 취향 공유 카드' })
      .getByRole('img', { name: /최근 6개월/ })).toBeVisible()
    await page.keyboard.press('Escape')
  }
})

test('empty history in both periods keeps the existing no-data guidance', async ({ page }) => {
  await signedInPreview(page)
  const empty = { ...record, genres: { ...record.genres, vector: {}, trackCount: 0, tagCount: 0, timeRange: 'medium_term' },
    character: null, profilePending: false, recommendationsPending: false }
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: empty }))
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '아직 음악 펫을 찾지 못했어요' })).toBeVisible()
  await expect(page.getByText('청취 기록이나 장르 정보가 부족해요. 음악을 더 듣고 다시 분석해주세요.', { exact: true })).toBeVisible()
  await expect(page.getByText('최근 4주 청취곡이 없어 최근 6개월 기록으로 분석했어요.', { exact: true })).toHaveCount(0)
})
