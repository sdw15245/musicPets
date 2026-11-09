import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

const artist = (name: string, id: string) => ({ name, uri: `spotify:artist:${id}`, imageUrl: '', basedOn: ['HANRORO'] })
const result = {
  id: 'artist-analysis', analyzedAt: '2026-11-09T01:00:00Z',
  genres: { vector: { indie: .7, rock: .3 }, unmappedTags: [], tagCount: 20, trackCount: 20, timeRange: 'short_term' },
  character: { slug: 'sulk-cat', name: '삐냥', description: '', imageUrl: '/characters/sulk-cat.png', score: .7 },
  profile: { mainstream: 40, obscurity: 60, comment: '인디 음악을 즐겨 듣는 취향이에요.' },
  recommendations: [], recommendedArtists: [artist('Redoor', 'redoor'), artist('Nerd Connection', 'nerd'), artist('Damons year', 'damons')],
  recommendationsAvailable: true, profilePending: false, recommendationsPending: false, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await mockAuth(page, 'artist-test');
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'listener', displayName: '음악친구', nickname: '음악친구', email: '' } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  await page.route('**/api/analysis/history/artist-analysis', route => route.fulfill({ json: result }))
})

test('artist results have Spotify artist links, no playlist action and readable mobile layout', async ({ page }, info) => {
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '이 아티스트도 들어보세요' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Redoor Spotify에서 듣기 (새 탭)', exact: true })).toHaveAttribute('href', 'https://open.spotify.com/artist/redoor')
  await expect(page.getByRole('button', { name: 'Spotify에 저장', exact: true })).toHaveCount(0)
  await expect(page.locator('.artist-recommendation')).toHaveCount(3)
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`artists-${width}.png`), fullPage: true })
  }
  await page.goto('/history/artist-analysis')
  await expect(page.getByRole('heading', { name: '그날의 추천 아티스트' })).toBeVisible()
  await expect(page.locator('.artist-recommendation')).toHaveCount(3)
})

test('empty artists can be retried without a new full analysis', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: { ...result, recommendedArtists: [] } }))
  let retries = 0
  await page.route('**/api/analysis/artist-analysis/recommendations', route => { retries++; return route.fulfill({ json: result }) })
  await page.goto('/result')
  await expect(page.getByText('아직 추천할 아티스트를 찾지 못했어요.')).toBeVisible()
  await page.getByRole('button', { name: '아티스트 다시 찾기' }).click()
  await expect(page.locator('.artist-recommendation')).toHaveCount(3)
  expect(retries).toBe(1)
})

test('artist rate limits preserve the pet and block retry', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: { ...result, recommendedArtists: [] } }))
  await page.route('**/api/analysis/artist-analysis/recommendations', route => route.fulfill({ status: 429, json: {
    error: 'SPOTIFY_RATE_LIMITED', message: 'Spotify 요청이 잠시 제한됐어요.', retryAfterSeconds: 120,
  } }))
  await page.goto('/result')
  await page.getByRole('button', { name: '아티스트 다시 찾기' }).click()
  await expect(page.getByRole('button', { name: '아티스트 다시 찾기' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: '삐냥', exact: true })).toBeVisible()
})

test('login has one clear primary action at desktop and mobile sizes', async ({ page }, info) => {
  await mockAuth(page, null)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'MusicPets 로그인' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Spotify로 계속하기', exact: true })).toBeVisible()
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`login-${width}.png`), fullPage: true })
  }
})
