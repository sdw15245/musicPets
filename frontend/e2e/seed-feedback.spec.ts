import { expect, test } from './test'
import { signedInPreview, mockPlayers } from './community-fixture'
import { sampleTracks } from './community-data'

test.beforeEach(async ({ page }) => { await signedInPreview(page); await mockPlayers(page) })

test('profile save shows pending feedback, preserves errors, and dismisses success without moving focus', async ({ page }, info) => {
  let fail = true
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/me', async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    if (fail) return route.fulfill({ status: 500, json: {} })
    await pending
    return route.fallback()
  })
  await page.goto('/mypage')
  const editTrigger = page.getByRole('button', { name: '이름 수정', exact: true })
  await editTrigger.click()
  const input = page.getByRole('textbox', { name: '이름', exact: true })
  await input.fill('음악 산책')
  await page.getByRole('button', { name: '프로필 저장' }).click()
  await expect(page.getByRole('alert')).toContainText('프로필을 저장하지 못했어요')
  await expect(input).toHaveValue('음악 산책')
  fail = false
  await page.getByRole('button', { name: '프로필 저장' }).click()
  const saving = page.getByRole('button', { name: /프로필 저장$/ })
  await expect(saving).toBeDisabled()
  await expect(saving.getByRole('progressbar')).toBeVisible()
  release()
  const notice = page.getByText('프로필을 저장했어요.', { exact: true })
  await expect(notice).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  // Hovering a snackbar intentionally pauses its timeout in SEED.
  await page.getByRole('heading', { name: '음악 산책', exact: true }).hover()
  await expect(input).toHaveCount(0)
  await expect(editTrigger).toBeFocused()
  await page.screenshot({ path: info.outputPath('profile-success.png') })
  await expect(notice).toHaveCount(0, { timeout: 7000 })
  await expect(editTrigger).toBeFocused()
})

test('missing and failed album images show neutral music placeholders in search', async ({ page }, info) => {
  await page.route('**/api/tracks/search?*', route => route.fulfill({ json: [
    sampleTracks[0], { ...sampleTracks[1], imageUrl: '/missing-test-cover.png' },
  ] }))
  await page.route('**/missing-test-cover.png', route => route.fulfill({ status: 404 }))
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await page.getByRole('textbox', { name: '곡 검색' }).fill('test')
  const options = page.locator('.share-options')
  await expect(options.locator('.art-placeholder')).toHaveCount(2)
  await expect(options.locator('.community-art img')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('album-fallback-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
