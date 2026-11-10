import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

// Controlled API delays isolate whether public copy depends on private requests.
// This measures text availability, not production LCP or real network latency.
test('home public copy timing under controlled API latency', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fallback()
  })
  const samples: { copyMs: number; resultMs: number }[] = []
  for (let i = 0; i < 3; i++) {
    const started = Date.now()
    if (i) await page.reload()
    else await page.goto('/')
    await expect(page.locator('.music-hero h1')).toContainText(/좋아하는 음악 속에|음악으로 발견한/)
    const copyMs = Date.now() - started
    await expect(page.getByRole('region', { name: '음악 펫 결과 예시' })).toBeVisible()
    samples.push({ copyMs, resultMs: Date.now() - started })
  }
  console.log('HOME_COPY_TIMING', JSON.stringify(samples))
  await info.attach('home-copy-timing.json', { body: JSON.stringify({ apiDelayMs: 300, samples }), contentType: 'application/json' })
})
