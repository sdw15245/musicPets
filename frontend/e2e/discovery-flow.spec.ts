import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

const result = {
  id: 'discovery', analyzedAt: '2026-11-07T00:00:00Z',
  genres: { vector: { indie: .5, pop: .25, rock: .15, 'hip-hop': .1 }, unmappedTags: [], tagCount: 10, trackCount: 20 },
  character: { slug: 'mochi', name: '모찌', description: '', imageUrl: '/characters/mochi.png', score: .9 },
  profile: { mainstream: 60, obscurity: 40, comment: '저장된 개인 취향 해설' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
})

test('current and historical results offer sharing and pet discovery even without songs', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.abort() })
  await page.route('**/api/analysis/history/discovery', route => route.fulfill({ json: result }))
  await page.goto('/result')
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '공유창 닫기' }).click()
  await page.getByRole('link', { name: '같은 펫의 음악 보기' }).click()
  await expect(page).toHaveURL(/\/community\?pet=mochi/)
  await expect(page.getByText('모찌와 같은 펫을 가진 사람들의 음악이에요.')).toBeVisible()
  await page.goto('/history/discovery')
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('음악 취향 공유 카드')
  expect(analyses).toBe(0)
})

test('feed keeps post navigation without redundant copy actions or pet-name badges', async ({ page }) => {
  await page.goto('/community')
  await expect(page.getByPlaceholder('글 내용·태그 검색')).toBeVisible()
  const post = page.locator('.community-post').first()
  await expect(post).toBeVisible()
  await expect(post.getByRole('button', { name: '글 링크 복사' })).toHaveCount(0)
  await expect(post.locator('.post-byline').getByText('모찌', { exact: true })).toHaveCount(0)
  await post.getByRole('link', { name: '글 보기' }).click()
  await expect(page).toHaveURL(/\/community\/posts\/1$/)
})

test('comparison leads with the actual pet change and initially limits genre detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [result, {
    ...result, id: 'older', analyzedAt: '2026-10-01T00:00:00Z',
    character: { ...result.character, slug: 'yuze', name: '유즈' },
    genres: { ...result.genres, vector: { indie: .1, pop: .2, rock: .4, 'hip-hop': .3 } },
  }] }))
  await page.goto('/history')
  await page.getByRole('button', { name: '취향 비교하기' }).click()
  const comparison = page.getByRole('region', { name: '취향 변화', exact: true })
  await expect(comparison.getByText('유즈 → 모찌', { exact: true })).toBeVisible()
  const genres = comparison.getByRole('list', { name: '장르 비중 변화' }).locator(':scope > li')
  await expect(genres).toHaveCount(2)
  await comparison.getByRole('button', { name: '장르 비교 더 보기' }).click()
  await expect(genres).toHaveCount(4)
})
