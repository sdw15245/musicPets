import { expect, test } from './test'
import { signedInPreview, mockPlayers } from './community-fixture'

const current = {
  id: 'current', analyzedAt: '2026-11-12T00:00:00Z',
  genres: { vector: { indie: .322, 'r-and-b': .376, rock: .052 }, trackCount: 20, tagCount: 30, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'sulk-cat', name: '리토', description: '', imageUrl: '/characters/sulk-cat.png', score: .8 },
  profile: { mainstream: 28, obscurity: 72, comment: '저장된 취향 해설' },
  recommendations: [], recommendedArtists: [], recommendationsAvailable: true, warnings: [],
}
const previous = { ...current, id: 'previous', analyzedAt: '2026-11-10T00:00:00Z',
  genres: { ...current.genres, vector: { indie: .353, 'r-and-b': .324, rock: .052 } } }

test('pet catalog shows all five immediately in the original left-aligned grid', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const cards = page.locator('.character-card:visible')
  await expect(cards).toHaveCount(5)
  await expect(page.getByRole('button', { name: '모든 펫 보기 (5)', exact: true })).toHaveCount(0)
  const first = await cards.nth(0).boundingBox(), fourth = await cards.nth(3).boundingBox()
  expect(Math.abs(first!.x - fourth!.x)).toBeLessThan(1)
  expect(fourth!.y).toBeGreaterThan(first!.y)
  await page.getByRole('button', { name: '리토 자세히 보기', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('펫을 만나면 이야기가 열려요.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '리토 자세히 보기', exact: true })).toBeFocused()
  await page.locator('.characters-section').screenshot({ path: info.outputPath('pets-restored.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(cards).toHaveCount(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('result compares with the closest older record, not response order or a newer record', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: current }))
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [
    { ...previous, id: 'oldest', analyzedAt: '2026-10-01T00:00:00Z' }, current,
    { ...previous, id: 'future', analyzedAt: '2026-11-13T00:00:00Z' }, previous,
  ] }))
  await page.goto('/result')
  const chart = page.getByRole('region', { name: '청취 기록의 장르 분석' })
  await expect(chart.getByRole('link', { name: /이전 분석/ })).toHaveAttribute('href', '/history/previous')
  await expect(chart.getByRole('listitem').filter({ hasText: 'R&B' })).toContainText('5.2%p 증가')
  await expect(chart.getByRole('listitem').filter({ hasText: '인디' })).toContainText('3.1%p 감소')
  await expect(chart.getByRole('listitem').filter({ hasText: '록' })).toContainText('변화 없음')
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await chart.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.result-listening-details').screenshot({ path: info.outputPath(`result-${width}.png`) })
  }
})

for (const scenario of ['first', 'different-period', 'unavailable']) {
  test(`result remains readable without misleading comparison: ${scenario}`, async ({ page }) => {
    await signedInPreview(page)
    await page.route('**/api/analysis/latest', route => route.fulfill({ json: current }))
    await page.route('**/api/analysis/history', route => scenario === 'unavailable'
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: scenario === 'first' ? [current] : [current, { ...previous, genres: { ...previous.genres, timeRange: 'medium_term' } }] }))
    await page.goto('/result')
    const chart = page.getByRole('region', { name: '청취 기록의 장르 분석' })
    await expect(chart).toContainText('37.6%')
    await expect(chart.getByText(/%p (증가|감소)/)).toHaveCount(0)
    if (scenario === 'different-period') await expect(chart).toContainText('이전 기록과 분석 기간이 달라 비교를 생략했어요.')
  })
}

test('saved results reveal chart bars once per visit and respect reduced motion', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: current }))
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [] }))
  await page.goto('/result')
  for (const selector of ['.genre-explorer', '.popularity-summary']) {
    const chart = page.locator(selector)
    await chart.scrollIntoViewIfNeeded()
    await expect(chart.locator('.genre-fill').first()).toHaveCSS('animation-name', 'genre-result-in')
    await chart.locator('.genre-fill').first().evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    await chart.evaluate(el => el.addEventListener('animationstart', () => el.setAttribute('data-replayed', 'true')))
    await page.evaluate(() => scrollTo(0, 0))
    await chart.scrollIntoViewIfNeeded()
    await expect(chart).not.toHaveAttribute('data-replayed', 'true')
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('.genre-fill').first()).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.genre-fill').first()).toHaveCSS('transform', 'none')
})

test('community search stays secondary and only expands on request in narrow feeds', async ({ page }, info) => {
  await mockPlayers(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/community')
  const input = page.getByRole('textbox', { name: '본문 또는 태그 검색' })
  await expect(input).toBeVisible()
  expect((await page.locator('.community-search').boundingBox())!.width).toBeLessThanOrEqual(240)
  await page.locator('.community-filterbar').screenshot({ path: info.outputPath('search-desktop.png') })
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(input).toBeHidden()
    await page.getByRole('button', { name: '검색 열기', exact: true }).click()
    await expect(input).toBeFocused()
    await input.fill('산책')
    await input.press('Enter')
    await expect(page.getByRole('article')).toHaveCount(2)
    await page.reload()
    await expect(input).toHaveValue('산책')
    await expect(input).toBeVisible()
    await page.getByRole('button', { name: '검색 초기화' }).click()
    await expect(input).toBeFocused()
    await page.getByRole('button', { name: '검색 닫기', exact: true }).click()
    await expect(input).toBeHidden()
    await expect(page.getByRole('button', { name: '검색 열기', exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.community-filterbar').screenshot({ path: info.outputPath(`search-${width}.png`) })
  }
})

test('only discovered pets are sharp in the catalog, dialog and collection', async ({ page }) => {
  await signedInPreview(page)
  await page.goto('/')
  const met = page.getByRole('button', { name: '멜로 자세히 보기', exact: true })
  const locked = page.getByRole('button', { name: '루바 자세히 보기', exact: true })
  await expect(met.locator('img')).toHaveCSS('filter', 'none')
  await expect(locked.locator('img')).toHaveCSS('filter', /blur/)
  await locked.click()
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCSS('filter', /blur/)
  await page.keyboard.press('Escape')
  await met.click()
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCSS('filter', 'none')
  await page.goto('/pets')
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '루바', exact: true }) }).locator('img')).toHaveCSS('filter', /blur/)
})

test('home pet name and match percentage share the same text alignment', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: current }))
  await page.goto('/')
  const identity = page.locator('.hero-result-preview .preview-identity')
  await expect(identity).toContainText('리토')
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const leftEdges = await identity.evaluate(el => ['h2', '.preview-tag'].map(selector => {
      const range = document.createRange()
      range.selectNodeContents(el.querySelector(selector)!)
      return range.getBoundingClientRect().left
    }))
    expect(Math.abs(leftEdges[0] - leftEdges[1])).toBeLessThan(1)
  }
})
