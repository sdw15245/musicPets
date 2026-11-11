import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const record = (id: string, date: string, vector: Record<string, number>, name = '멜로') => ({
  id, analyzedAt: date, genres: { vector, tagCount: 10, trackCount: 10, unmappedTags: [] },
  character: { slug: name === '리프' ? 'yuze' : name === '루바' ? 'pip' : 'mochi', name, description: '나를 닮은 펫', imageUrl: '/characters/mochi.png', score: .8 },
  profile: { mainstream: 50, obscurity: 50, comment: '저장된 취향 해설' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
})
const records = [
  record('new', '2026-11-04T07:52:00Z', { indie: .384, 'r-and-b': .227, 'hip-hop': .226, rock: .066, 'k-pop': .0554, pop: .039, folk: .004 }),
  record('old', '2026-11-02T21:47:00Z', { indie: .532, 'r-and-b': .176, 'hip-hop': .125, rock: .076, 'k-pop': .0516, pop: .036, folk: .003 }, '리프'),
  record('older', '2026-10-01T00:00:00Z', { indie: .2, jazz: .8 }, '루바'),
]

test('comparison shows dated pairs, consistent rounded differences, and switches previous records', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/history', route => route.fulfill({ json: records }))
  await page.goto('/history')
  await page.getByRole('button', { name: '취향 비교하기' }).click()
  const comparison = page.getByRole('region', { name: '취향 변화', exact: true })
  const select = comparison.getByRole('combobox', { name: '비교할 이전 기록' })
  await expect(select).toHaveValue('old')
  await expect(select.locator('option')).toHaveCount(2)
  await expect(comparison.getByText('인디 비중이 가장 크게 줄었어요.')).toBeVisible()
  await expect(comparison.getByRole('list', { name: '장르 비중 변화' }).getByRole('listitem')).toHaveCount(2)
  await comparison.getByRole('button', { name: '장르 비교 더 보기' }).click()
  await expect(comparison.getByRole('list', { name: '장르 비중 변화' }).getByRole('listitem')).toHaveCount(5)
  const kpop = comparison.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'K-Pop', exact: true }) })
  await expect(kpop).toContainText('이전 5.2%')
  await expect(kpop).toContainText('최근 5.5%')
  await expect(kpop).toContainText('0.3%p 증가')
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: info.outputPath('comparison-desktop.png'), fullPage: true })
  await select.selectOption('older')
  await expect(comparison.getByText('재즈 비중이 가장 크게 줄었어요.')).toBeVisible()
  await expect(comparison).toContainText('루바')
  await select.selectOption('old')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: info.outputPath('comparison-mobile.png'), fullPage: true })
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.addStyleTag({ content: 'html { font-size: 150%; }' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('empty recommendations can retry without a new analysis and expired seeds explain recovery', async ({ page }) => {
  await signedInPreview(page)
  let analyses = 0, retries = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: records[0] }) })
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: { ...records[0], warnings: ['일부 곡의 청취자 수가 없어 대중성 분석에서 제외했어요.'] } }))
  await page.route('**/api/analysis/new/recommendations', route => { retries++; return route.fulfill({ status: 409, json: { message: '분석이 만료되었습니다.' } }) })
  await page.goto('/result')
  await expect(page.getByText('확인할 수 있는 곡의 Last.fm 청취자 수만 대중성 계산에 사용했어요.')).toBeVisible()
  await expect(page.locator('.analysis-notices')).toHaveCount(0)
  await page.getByRole('button', { name: '추천곡 다시 시도' }).click()
  await expect(page.getByText('이 분석의 추천곡을 다시 찾을 수 있는 시간이 지났어요.')).toBeVisible()
  expect(retries).toBe(1)
  expect(analyses).toBe(0)
  await expect(page.getByRole('button', { name: '음악 취향 새로 분석하기' })).toBeVisible()
})
