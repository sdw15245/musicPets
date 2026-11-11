import { expect, test } from './test'
import { signedInPreview } from './community-fixture'
import { AnalysisSchema } from '../src/features/analysis/schemas'
import { MeSchema } from '../src/features/auth/schemas'

const legacy = {
  id: 'old-name', analyzedAt: '2026-11-10T00:00:00Z',
  genres: { vector: { 'hip-hop': .6, 'r-and-b': .4 }, tagCount: 10, trackCount: 20, unmappedTags: [] },
  character: { slug: 'sulk-cat', name: '삐냥', description: '', imageUrl: '/characters/sulk-cat.png', score: .8 },
  profile: { mainstream: 40, obscurity: 60, comment: '삐냥은 R&B를 좋아해요. 삐냥과 닮았어요.' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test('saved API results use current pet names without changing identity, scores or unknown pets', () => {
  const result = AnalysisSchema.parse(legacy)
  expect(result.character).toEqual({ ...legacy.character, name: '리토' })
  expect(result.profile?.comment).toBe('리토는 R&B를 좋아해요. 리토와 닮았어요.')
  expect(legacy.character.name).toBe('삐냥')
  const unknown = { ...legacy, character: { ...legacy.character, slug: 'future', name: '새 펫' }, profile: null }
  expect(AnalysisSchema.parse(unknown).character?.name).toBe('새 펫')
  expect(AnalysisSchema.parse({ ...legacy, character: null, profile: null }).character).toBeNull()
})

test('legacy collection names resolve to stable slugs and leave user profile text untouched', () => {
  const me = MeSchema.parse({ id: 1, spotifyId: 'me', email: '', displayName: '모찌', nickname: '삐냥',
    analyzedPet: '삐냥', unlockedCharacters: ['모찌', '핍', '봉봉', '유즈', '삐냥', 'future'] })
  expect(me.unlockedCharacters).toEqual(['mochi', 'pip', 'bongbong', 'yuze', 'sulk-cat', 'future'])
  expect(me.analyzedPet).toBe('sulk-cat')
  expect(me.displayName).toBe('모찌')
  expect(me.nickname).toBe('삐냥')
})

test('old results and history render the renamed pet consistently', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: legacy }))
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [legacy] }))
  await page.route('**/api/analysis/history/old-name', route => route.fulfill({ json: legacy }))
  for (const path of ['/result', '/history/old-name']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: '리토', exact: true })).toBeVisible()
    await expect(page.locator('.profile-comment')).toContainText('리토는 R&B를 좋아해요. 리토와 닮았어요.')
    await expect(page.locator('.analysis-overview')).not.toContainText('삐냥')
  }
})
