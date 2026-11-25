import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const record = {
  id: 'pet-story', analyzedAt: '2026-11-09T00:00:00Z',
  genres: { vector: { pop: .4, indie: .28, electronic: .12, rock: .1, 'r-and-b': .1 }, trackCount: 20, tagCount: 30, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'mochi', name: '멜로', description: '', imageUrl: '/characters/mochi.png', score: .8 },
  profile: { mainstream: 50, obscurity: 50, comment: '저장된 해설' },
  recommendations: [], recommendedArtists: [], recommendationsAvailable: true, warnings: [],
}

test('opening the pet story leaves the pet portrait where it stood', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: record }))
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/result')
    const overview = page.getByRole('region', { name: '음악 취향 요약' })
    const photo = overview.getByRole('img', { name: '멜로' })
    await expect(photo).toBeVisible()
    // Page coordinates: opening the story may scroll the page, which is fine; the photo itself must not move.
    const place = () => photo.evaluate(element => {
      const box = element.getBoundingClientRect()
      return { x: box.x + window.scrollX, y: box.y + window.scrollY, width: box.width, height: box.height }
    })
    const closed = await place()
    await overview.getByText('멜로의 이야기').click()
    await expect(overview.getByText('멜로의 방에는')).toBeVisible()
    expect(await place(), `${width}px`).toEqual(closed)
  }
})
