import { expect, test, type Page } from './test'
import { mockPlayers } from './community-fixture'
import { mockAuth } from './auth-fixture'

test.beforeEach(async ({ page }) => {
  await mockPlayers(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'sample', email: '', displayName: 'Sample' } }))
})

// 서버는 모킹한다. subject가 실제 로그인과 같은 형태인 테스트용 JWT다.
function token(id: string) {
  return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, type: 'access' })).toString('base64url')}.test`
}

async function signIn(page: Page, userId: string | null) {
  await mockAuth(page, userId ? token(userId) : null)
  await page.reload()
}

test('analysis unlocks belong to an account and unowned legacy records are retained without attribution', async ({ page }) => {
  let analyzed = false
  await page.route('**/api/me', route => {
    const token = route.request().headers().authorization?.split('.')[1]
    const owner = token ? JSON.parse(Buffer.from(token, 'base64url').toString()).sub : null
    return route.fulfill({ json: { id: Number(owner), spotifyId: 'sample', email: '', displayName: 'Sample',
      analyzedPet: analyzed && owner === '1' ? 'pip' : null, unlockedCharacters: analyzed && owner === '1' ? ['pip'] : [] } })
  })
  await page.route('**/api/analysis', route => { analyzed = true; return route.fulfill({ json: {
    id: 'account-analysis', analyzedAt: '2026-09-30T00:00:00Z',
    genres: { vector: { pop: 1 }, tagCount: 1, trackCount: 1, unmappedTags: [] },
    character: { slug: 'pip', name: '핍', description: '신난 장난꾸러기', imageUrl: '/characters/pip.png', score: .9 },
    profile: { mainstream: 50, obscurity: 50, comment: '음악 취향' },
    recommendations: [], recommendationsAvailable: true, warnings: [],
  } }) })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('unlocked-characters', JSON.stringify({ version: 0, state: { unlocked: ['mochi'] } })))
  await signIn(page, '1')
  await expect(page.locator('.character-card').filter({ hasText: '발견 완료' }).getByRole('img')).toHaveCount(0)
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  await page.getByRole('link', { name: 'MusicPets', exact: true }).click()
  await expect(page.locator('.character-card').filter({ hasText: '발견 완료' }).getByRole('img')).toHaveAttribute('alt', '핍')
  await signIn(page, '2')
  await expect(page.locator('.character-card').filter({ hasText: '발견 완료' }).getByRole('img')).toHaveCount(0)
  await signIn(page, '1')
  await expect(page.locator('.character-card').filter({ hasText: '발견 완료' }).getByRole('img')).toHaveAttribute('alt', '핍')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('unlocked-characters')!).state.unlocked)).toEqual(['mochi'])
})
