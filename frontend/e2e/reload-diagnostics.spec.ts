import { expect, test } from './test'
import { signedInPreview } from './community-fixture'
import { writeFile } from 'node:fs/promises'

// Controlled network latency, not a production/backend speed benchmark.
test('reload shares authentication and starts home data in parallel', async ({ page }, info) => {
  await signedInPreview(page)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const observations: unknown[] = []
  let calls: { path: string; at: number }[] = []
  let start = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    calls.push({ path, at: Date.now() - start })
    await delay(path === '/api/me' ? 600 : 100)
    await route.fallback()
  })
  for (let i = 0; i < 3; i++) {
    calls = []
    start = Date.now()
    const meDone = page.waitForResponse(response => response.url().endsWith('/api/me'))
    if (i) await page.reload()
    else await page.goto('/')
    await expect(page.locator('.music-hero')).toBeVisible()
    await expect(page.locator('.music-hero').getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toBeVisible()
    const heroReadyMs = Date.now() - start
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
    // Wait for the deliberately slow /me independently of the hero.
    await meDone
    for (const path of ['/api/auth/csrf', '/api/auth/refresh', '/api/me', '/api/analysis/latest', '/api/notifications/unread-count']) {
      expect(calls.filter(call => call.path === path), path).toHaveLength(1)
    }
    expect(calls.filter(call => call.path === '/api/analysis')).toHaveLength(0)
    const resources = await page.evaluate(() => ({
      scripts: performance.getEntriesByType('resource').filter(entry => (entry as PerformanceResourceTiming).initiatorType === 'script').length,
      paints: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, start: entry.startTime })),
    }))
    observations.push({ iteration: i, heroReadyMs, calls, ...resources })
  }
  const report = info.outputPath('reload-diagnostics.json')
  await writeFile(report, JSON.stringify({ controlledLatencyMs: { default: 100, me: 600 }, observations }, null, 2))
  await info.attach('reload-diagnostics.json', { path: report, contentType: 'application/json' })
})
