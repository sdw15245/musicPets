import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test('new result navigation starts at the top while back and landing anchors preserve their positions', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: {
    id: 'navigation-result', analyzedAt: '2026-10-10T00:00:00Z',
    genres: { vector: { pop: 1 }, tagCount: 5, trackCount: 10, unmappedTags: [] },
    character: { slug: 'mochi', name: '멜로', description: '아늑한 몽상가', imageUrl: '/characters/mochi.png', score: .9 },
    profile: { mainstream: 60, obscurity: 40, comment: '편안한 팝을 즐겨 들어요.' },
    recommendations: [], recommendationsAvailable: true, warnings: [],
  } }))
  await page.goto('/')
  await expect(page.getByRole('region', { name: '나의 음악 취향 요약' })).toBeVisible()
  await page.locator('.cta-section').scrollIntoViewIfNeeded()
  const previousScroll = await page.evaluate(() => scrollY)
  expect(previousScroll).toBeGreaterThan(500)
  await page.locator('.cta-section').getByRole('link', { name: '내 취향 보기' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 취향')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.goBack()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500)
})

test('guest landing anchors reserve space for the header', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '캐릭터', exact: true }).click()
  // The anchor's scroll margin reserves space for the fixed header.
  await expect.poll(async () => {
    const header = await page.getByRole('banner').boundingBox()
    return page.locator('#characters').evaluate((element, headerBottom) => {
      const top = element.getBoundingClientRect().top
      const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop)
      return top >= headerBottom && top <= margin + 1
    }, header ? header.y + header.height : 0)
  }).toBe(true)
})
