import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { sampleTracks } from './community-data'

test.beforeEach(async ({ page }) => { await signedInPreview(page); await mockPlayers(page) })

test('one Korean character searches automatically after composition, bursts are debounced and empty input clears results', async ({ page }) => {
  const queries: string[] = []
  await page.route('**/api/tracks/search?*', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q')!)
    return route.fulfill({ json: [{ ...sampleTracks[0], name: '옛 노래' }] })
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'))
  const input = page.getByRole('textbox', { name: '곡 검색' })
  const expectResult = async () => {
    // 응답 후 React Query의 예약된 화면 갱신도 가상 시간으로 진행한다.
    await expect.poll(async () => {
      await page.clock.runFor(10)
      return page.getByRole('button', { name: /옛 노래 —/ }).isVisible()
    }).toBe(true)
  }
  await input.dispatchEvent('compositionstart')
  await input.fill('ㅇ')
  await page.clock.runFor(600)
  await input.fill('옛')
  await page.clock.runFor(600)
  expect(queries).toEqual([])
  await input.dispatchEvent('compositionend')
  await page.clock.runFor(500)
  await expectResult()
  expect(queries).toEqual(['옛'])
  await input.fill('옛 사')
  await expect(page.getByRole('button', { name: /옛 노래 —/ })).toHaveCount(0)
  await page.clock.runFor(200)
  await input.fill('옛 사랑')
  await page.clock.runFor(499)
  expect(queries).toEqual(['옛'])
  await page.clock.runFor(1)
  await expectResult()
  expect(queries).toEqual(['옛', '옛 사랑'])
  await input.fill('')
  await page.clock.runFor(600)
  await expect(page.getByRole('button', { name: /옛 노래 —/ })).toHaveCount(0)
  expect(queries).toHaveLength(2)
  await input.fill('옛')
  await page.clock.runFor(500)
  await expectResult()
  expect(queries).toHaveLength(2)
})

test('a slow older search cannot replace the latest results and Enter searches immediately', async ({ page }) => {
  let release!: () => void
  const oldRequest = new Promise<void>(resolve => { release = resolve })
  const queries: string[] = []
  await page.route('**/api/tracks/search?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q')!
    queries.push(q)
    if (q === '옛') await oldRequest
    return route.fulfill({ json: [{ ...sampleTracks[0], name: q === '옛' ? '이전 검색 결과' : '최신 검색 결과' }] })
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const input = page.getByRole('textbox', { name: '곡 검색' })
  await input.fill('옛')
  await expect.poll(() => queries).toEqual(['옛'])
  await input.fill('사랑')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: /최신 검색 결과 —/ })).toBeVisible()
  release()
  await expect(page.getByRole('button', { name: /이전 검색 결과 —/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /최신 검색 결과 —/ })).toBeVisible()
  expect(queries).toEqual(['옛', '사랑'])
})

test('Spotify cooldown survives clearing the input and automatic searches stay paused until manual retry', async ({ page }) => {
  let calls = 0
  await page.route('**/api/tracks/search?*', route => {
    calls++
    return route.fulfill(calls === 1
      ? { status: 429, json: { error: 'SPOTIFY_RATE_LIMITED', retryAfterSeconds: 2 } }
      : { json: [{ ...sampleTracks[0], name: '재시도 성공' }] })
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const start = new Date('2026-10-10T00:00:00Z')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(start)
  const input = page.getByRole('textbox', { name: '곡 검색' })
  await input.fill('옛')
  await page.clock.runFor(500)
  await expect(page.getByRole('alert')).toContainText('Spotify 요청이 잠시 제한됐어요')
  await input.fill('')
  await input.fill('다른 곡')
  await page.clock.runFor(1000)
  await expect(page.getByRole('button', { name: '검색', exact: true })).toBeDisabled()
  expect(calls).toBe(1)
  await page.clock.runFor(2000)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('button', { name: /재시도 성공 —/ })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(calls).toBe(2)
})
