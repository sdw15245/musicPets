import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const record = {
  id: 'top-five', analyzedAt: '2026-11-09T00:00:00Z',
  genres: { vector: { jazz: .03, rock: .12, pop: .32, indie: .25, folk: .05, electronic: .08, 'r-and-b': .15 },
    trackCount: 20, tagCount: 30, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'mochi', name: '멜로', description: '', imageUrl: '/characters/mochi.png', score: .8 },
  profile: { mainstream: 50, obscurity: 50, comment: '저장된 해설' },
  recommendations: [], recommendedArtists: [], recommendationsAvailable: true, warnings: [],
}

test('current and historical results show only five ranked genres with original percentages', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: record }))
  await page.route('**/api/analysis/history/top-five', route => route.fulfill({ json: record }))
  for (const path of ['/result', '/history/top-five']) {
    await page.goto(path)
    const genres = page.getByRole('region', { name: '청취 기록의 장르 분석' })
    const rows = genres.locator('summary')
    await expect(rows).toHaveCount(5)
    await expect(rows).toHaveText(['팝32.0%', '인디25.0%', 'R&B15.0%', '록12.0%', '일렉트로닉8.0%'])
    await expect(genres.getByText('재즈', { exact: true })).toHaveCount(0)
    await rows.first().click()
    await expect(rows.first().locator('..')).toHaveAttribute('open', '')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
      await page.screenshot({ path: info.outputPath(`${path === '/result' ? 'current' : 'history'}-${width}.png`), fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
