import { expect, test } from './test'

test('landing navigation reaches the original introduction without a pinned scroll sequence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '이용 방법', exact: true }).click()
  await expect(page.getByRole('heading', { name: /듣던 음악으로\s*나의 펫을 찾는 방법/ })).toBeInViewport()
  const flow = page.getByRole('list', { name: '음악 펫을 만나는 과정' })
  await expect(flow.locator(':scope > li')).toHaveCount(3)
  await expect(page.locator('.scroll-intro')).toHaveCount(0)
  await page.getByRole('button', { name: '캐릭터', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떤 펫을 만나게 될까요?' })).toBeInViewport()
})

test('the narrow landing keeps analysis, carousel and navigation available', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toBeInViewport()
  await expect(page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기' })).toHaveAttribute('href', '/analyze')
  const preview = page.getByRole('region', { name: '음악 펫 결과 예시' })
  await preview.getByRole('button', { name: '다음 펫 보기' }).click()
  await expect(preview.getByRole('img', { name: '핍', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
