import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

test('selected Rive renders locally and moves during the analysis reveal wait', async ({ page }, info) => {
  await signedInPreview(page)
  let release!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/analysis', async route => {
    await hold
    await route.fulfill({ json: { id: 'rive', analyzedAt: '2026-11-08T00:00:00Z',
      genres: { vector: {}, trackCount: 20, tagCount: 0, unmappedTags: [] }, character: null,
      profile: { mainstream: 0, obscurity: 0, comment: '완료' }, recommendations: [], recommendationsAvailable: true, warnings: [],
    } })
  })
  await page.goto('/analyze')
  await expect(page.locator('.analysis-animation')).toHaveAttribute('data-ready', 'true', { timeout: 15000 })
  const canvas = page.locator('.analysis-animation canvas')
  const first = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).not.toBe(first)
  await page.screenshot({ path: info.outputPath('analysis-rive-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: '홈으로', exact: true })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('analysis-rive-mobile.png') })
  release()
  await expect(page).toHaveURL(/\/result$/)
})

test('failed animation keeps the actual analysis status usable', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/animations/loading-documents.riv', route => route.abort())
  await page.route('**/api/analysis', () => {})
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하고 있어요' })).toBeVisible()
  await expect(page.locator('.analysis-animation-fallback')).toBeVisible()
  await page.getByRole('link', { name: '홈으로', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('reduced motion keeps a visible static illustration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signedInPreview(page)
  await page.route('**/api/analysis', () => {})
  await page.goto('/analyze')
  await expect(page.locator('.analysis-animation')).toHaveAttribute('data-ready', 'true')
  const canvas = page.locator('.analysis-animation canvas')
  const visiblePixels = () => canvas.evaluate(element => {
    const c = element as HTMLCanvasElement
    return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((value, i) => i % 4 === 3 && value > 0)
  })
  await expect.poll(visiblePixels).toBe(true)
  const first = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())
  await page.waitForTimeout(300)
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(first)
})
