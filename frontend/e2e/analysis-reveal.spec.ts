import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const result = {
  id: 'reveal', analyzedAt: '2026-11-09T00:00:00Z',
  genres: { vector: { pop: 1 }, trackCount: 20, tagCount: 20, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'mochi', name: '모찌', description: '', imageUrl: '/characters/mochi.png', score: .8 },
  profile: { mainstream: 50, obscurity: 50, comment: '대기 중 완성된 해설' },
  recommendations: [], recommendedArtists: [], recommendationsAvailable: true, warnings: [],
  profilePending: false, recommendationsPending: false,
}

test.beforeEach(async ({ page }) => {
  await signedInPreview(page)
  await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'))
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  await page.route('**/api/analysis/history/reveal', route => route.fulfill({ json: result }))
})

test('details complete during the reveal wait and saved result reads do not wait', async ({ page }) => {
  const core = { ...result, profile: null, profilePending: true, recommendationsPending: true }
  await page.route('**/api/analysis', route => route.fulfill({ json: core }))
  const details: string[] = []
  for (const section of ['profile', 'recommendations/initial']) {
    await page.route(`**/api/analysis/reveal/${section}`, route => {
      details.push(section)
      return route.fulfill({ json: result })
    })
  }
  await page.goto('/analyze')
  await expect.poll(() => details.length).toBe(2)
  await expect(page).toHaveURL('/analyze')
  await page.clock.runFor(2499)
  await expect(page).toHaveURL('/analyze')
  await page.clock.runFor(351)
  await expect(page).toHaveURL('/result')
  await expect(page.getByText(result.profile.comment, { exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: '취향 설명을 쓰고 있어요.' })).toHaveCount(0)
  for (const path of ['/result', '/history/reveal']) {
    let received = false
    const response = page.waitForResponse(path === '/result' ? '**/api/analysis/latest' : '**/api/analysis/history/reveal')
      .then(() => { received = true })
    await page.goto(path)
    // Module downloads use real time; keep React's paused clock moving until
    // the saved result renders, still well below the 2.5s analysis reveal wait.
    let elapsed = 0
    await expect.poll(async () => {
      if (elapsed < 2000) {
        await page.clock.runFor(50)
        elapsed += 50
      }
      return received && await page.getByText(result.profile.comment, { exact: true }).isVisible()
    }, { intervals: [100] }).toBe(true)
    await response
    await expect(page.getByText(result.profile.comment, { exact: true })).toBeVisible()
  }
})

test('errors skip the minimum, retry starts a fresh wait, and leaving never redirects later', async ({ page }) => {
  let calls = 0
  await page.route('**/api/analysis', route => route.fulfill(++calls === 1
    ? { status: 502, json: {} } : { json: result }))
  const failed = page.waitForResponse('**/api/analysis')
  await page.goto('/analyze')
  await failed
  await page.clock.runFor(350)
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하지 못했어요' })).toBeVisible()
  const retried = page.waitForResponse('**/api/analysis')
  await page.getByRole('button', { name: '다시 분석하기', exact: true }).click()
  await retried
  await page.clock.runFor(2400)
  await expect(page).toHaveURL('/analyze')
  await page.getByRole('link', { name: '홈으로', exact: true }).click()
  await page.clock.runFor(500)
  await expect(page).toHaveURL('/')
  expect(calls).toBe(2)
})
