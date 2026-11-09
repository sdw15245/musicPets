import { expect, test } from './test'
import { signedInPreview, mockPlayers } from './community-fixture'
import { sampleTracks } from './community-data'

const result = {
  id: 'limited-result', analyzedAt: '2026-10-28T00:00:00Z',
  genres: { vector: { pop: 1 }, unmappedTags: [], tagCount: 1, trackCount: 1 },
  character: { slug: 'pip', name: '핍', description: '음악 친구', imageUrl: '/characters/pip.png', score: .9 },
  profile: { mainstream: 60, obscurity: 40, comment: '보관된 결과' },
  recommendations: [{ ...sampleTracks[0] }], recommendationsAvailable: true, warnings: [],
}
const limit = { error: 'APP_RATE_LIMITED', message: '요청이 많아 잠시 기다려야 해요.', retryAfterSeconds: 60 }

test.beforeEach(async ({ page }) => { await signedInPreview(page); await mockPlayers(page) })

test('analysis admission limit preserves login, waits for cooldown and never retries automatically', async ({ page }) => {
  await page.clock.install()
  let calls = 0
  let restores = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/refresh') restores++ })
  await page.route('**/api/analysis', route => route.fulfill(++calls === 1 ? { status: 429, json: limit } : { json: result }))
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: '요청이 잠시 제한됐어요', exact: true })).toBeVisible()
  const retry = page.getByRole('button', { name: '다시 분석하기' })
  await expect(retry).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Spotify 다시 연결' })).toHaveCount(0)
  await page.clock.fastForward(61_000)
  await expect(retry).toBeEnabled()
  expect(calls).toBe(1)
  expect(restores).toBe(1)
  await retry.click()
  await expect(page.getByText('보관된 결과', { exact: true })).toBeVisible()
})

test('playlist admission limit keeps the result and allows one manual retry after waiting', async ({ page }) => {
  await page.clock.install()
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  let calls = 0
  await page.route('**/api/analysis/recommendations/save', route => route.fulfill(++calls === 1
    ? { status: 429, json: limit } : { json: { playlistUrl: 'https://open.spotify.com/playlist/test' } }))
  await page.goto('/result')
  const save = page.getByRole('button', { name: 'Spotify에 저장' })
  await save.click()
  await expect(save).toBeDisabled()
  await expect(page.getByText('보관된 결과', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '요청이 잠시 제한됐어요', exact: true })).toBeVisible()
  await page.clock.fastForward(61_000)
  await expect(save).toBeEnabled()
  expect(calls).toBe(1)
  await save.click()
  await expect(page.getByRole('link', { name: /플레이리스트 열기/ })).toBeVisible()
})

test('song search admission cooldown survives clearing text and preserves the composer draft', async ({ page }) => {
  await page.clock.install()
  let calls = 0
  await page.route('**/api/tracks/search?*', route => route.fulfill(++calls === 1 ? { status: 429, json: limit } : { json: [sampleTracks[0]] }))
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const input = page.getByRole('textbox', { name: '곡 검색' })
  await input.fill('seasons')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('heading', { name: '요청이 잠시 제한됐어요', exact: true })).toBeVisible()
  await input.fill('')
  await input.fill('다른 곡')
  await expect(page.getByRole('button', { name: '검색', exact: true })).toBeDisabled()
  await page.clock.fastForward(61_000)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('button', { name: 'seasons — wave to earth' })).toBeVisible()
})

test('post admission limit preserves text and only publishes after manual retry', async ({ page }) => {
  await page.clock.install()
  let calls = 0
  await page.route(/\/api\/posts(?:\?.*)?$/, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    calls++
    if (calls === 1) await route.fulfill({ status: 429, json: limit })
    else await route.fallback()
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await page.getByRole('textbox', { name: '곡 검색' }).fill('seasons')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByRole('button', { name: 'seasons — wave to earth' }).click()
  const draft = page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })
  await draft.fill('기다려도 남아 있는 내 이야기')
  const publish = page.getByRole('button', { name: '공유하기', exact: true })
  await publish.click()
  await expect(publish).toBeDisabled()
  await expect(draft).toHaveValue('기다려도 남아 있는 내 이야기')
  await page.clock.fastForward(61_000)
  await expect(publish).toBeEnabled()
  expect(calls).toBe(1)
  await publish.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('article').filter({ hasText: '기다려도 남아 있는 내 이야기' })).toBeVisible()
})
