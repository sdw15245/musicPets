import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const record = {
  id: 'motion-result', analyzedAt: '2026-11-09T00:00:00Z',
  genres: { vector: { pop: .6, indie: .4 }, trackCount: 20, tagCount: 30, unmappedTags: [], timeRange: 'short_term' },
  character: { slug: 'mochi', name: '모찌', description: '', imageUrl: '/characters/mochi.png', score: .8 },
  profile: { mainstream: 50, obscurity: 50, comment: '저장된 취향 해설' },
  recommendations: [], recommendedArtists: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/analysis', route => route.fulfill({ json: record }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: record }))
  await page.route('**/api/analysis/history/motion-result', route => route.fulfill({ json: record }))
})

test('a new result reveals once; sharing stays usable and reload or history does not replay', async ({ page }) => {
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.locator('.analysis-pet')).toHaveCSS('animation-name', 'pet-result-in')
  await expect(page.getByRole('button', { name: '결과 공유하기', exact: true })).toBeEnabled()
  const genres = page.getByRole('region', { name: '청취 기록의 장르 분석' })
  await genres.scrollIntoViewIfNeeded()
  await expect(genres).toHaveAttribute('data-revealed', 'true')
  await expect(genres.locator('.genre-fill').first()).toHaveCSS('animation-name', 'genre-result-in')
  await genres.locator('.genre-fill').first().evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  await page.evaluate(() => {
    document.querySelector('.genre-fill')!.addEventListener('animationstart', () => {
      document.querySelector('.genre-explorer')!.setAttribute('data-replayed', 'true')
    })
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await genres.scrollIntoViewIfNeeded()
  await expect(genres).not.toHaveAttribute('data-replayed', 'true')
  await page.reload()
  await expect(page.locator('.analysis-pet')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.genre-fill').first()).toHaveCSS('animation-name', 'none')
  await page.goto('/history/motion-result')
  await expect(page.locator('.analysis-pet')).toHaveCSS('animation-name', 'none')
})

test('reduced motion shows the complete result without decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/analyze')
  await expect(page.locator('.analysis-pet')).toHaveCSS('animation-name', 'none')
  const fill = page.locator('.genre-fill').first()
  await fill.scrollIntoViewIfNeeded()
  await expect(fill).toHaveCSS('transform', 'none')
  await expect(fill).toHaveCSS('animation-name', 'none')
  await expect(page.getByText('저장된 취향 해설', { exact: true })).toBeVisible()
})

test('share preparation reserves the final card size and keeps download disabled until ready', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const delayed = { ...record, character: { ...record.character, imageUrl: '/characters/mochi.png?share-delay' } }
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: delayed }))
  await page.route('**/characters/mochi.png?share-delay', async route => { await pending; await route.continue() })
  await page.goto('/result', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드' })
  const frame = dialog.locator('.result-share-frame')
  await expect(frame.getByRole('status')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'PNG 저장하기' })).toBeDisabled()
  // Measure layout after the dialog's own opening scale finishes.
  await dialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  const before = await frame.boundingBox()
  expect(before!.height).toBeGreaterThan(200)
  release()
  await expect(dialog.getByRole('img', { name: /취향 해설이 담긴/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'PNG 저장하기' })).toBeEnabled()
  const after = await frame.boundingBox()
  expect(Math.abs(before!.height - after!.height)).toBeLessThan(1)
  await page.screenshot({ path: info.outputPath('share-ready-mobile.png') })
})

test('late interpretation fades in without replaying or moving the pet', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/analysis', route => route.fulfill({ json: { ...record, profile: null, profilePending: true } }))
  await page.route('**/api/analysis/motion-result/profile', async route => {
    await pending
    await route.fulfill({ json: { ...record, profilePending: false } })
  })
  await page.goto('/analyze')
  const pet = page.locator('.analysis-pet')
  await expect(page.getByRole('status', { name: '취향 설명을 쓰고 있어요.' })).toBeVisible()
  await pet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  const before = await pet.boundingBox()
  await pet.evaluate(element => element.addEventListener('animationstart', () => element.setAttribute('data-replayed', 'true')))
  release()
  await expect(page.locator('.profile-comment')).toHaveText('저장된 취향 해설')
  await expect(page.locator('.profile-comment')).toHaveCSS('animation-name', 'result-content-in')
  await expect(pet).not.toHaveAttribute('data-replayed', 'true')
  const after = await pet.boundingBox()
  expect(after!.x).toBe(before!.x)
  expect(after!.y).toBe(before!.y)
})

test('comparison animates existing bars when the previous record changes', async ({ page }) => {
  const records = [record,
    { ...record, id: 'old', analyzedAt: '2026-11-01T00:00:00Z', genres: { ...record.genres, vector: { pop: .3, indie: .7 } } },
    { ...record, id: 'older', analyzedAt: '2026-10-01T00:00:00Z', genres: { ...record.genres, vector: { pop: .2, indie: .8 } } }]
  await page.route('**/api/analysis/history', route => route.fulfill({ json: records }))
  await page.goto('/history')
  await page.getByRole('button', { name: '취향 비교하기' }).click()
  const beforeBar = page.locator('.comparison-bar-row:not(.is-recent) .comparison-bar-track > span').first()
  await expect(beforeBar).toHaveCSS('transition-property', 'width')
  await expect(beforeBar).toHaveCSS('transition-duration', '0.2s')
  await page.getByRole('combobox', { name: '비교할 이전 기록' }).selectOption('older')
  await expect(page.locator('.comparison-highlight')).toContainText('40.0')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(beforeBar).toHaveCSS('transition-duration', '0s')
})
