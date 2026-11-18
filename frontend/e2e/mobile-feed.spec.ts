import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test.use({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true })
test.beforeEach(async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.goto('/community')
  await expect(page.getByRole('article').first()).toBeVisible()
})

test('both sort options are one tap away and keep the feed in place', async ({ page }) => {
  const sort = page.getByRole('radiogroup', { name: '게시글 정렬' })
  const top = await page.evaluate(() => scrollY)
  for (const name of ['인기순', '최신순']) {
    await sort.getByText(name, { exact: true }).tap({ timeout: 5000 })
    await expect(sort.getByRole('radio', { name, exact: true })).toBeChecked()
    await expect(page).toHaveURL(url => url.searchParams.get('sort') === (name === '인기순' ? 'popular' : null))
    expect(await page.evaluate(() => scrollY)).toBe(top)
  }
})

test('all member header controls fit in one row on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const header = page.getByRole('banner')
  const profile = header.getByRole('button', { name: '프로필' })
  await expect(profile).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const logo = await header.getByRole('link', { name: 'MusicPets' }).boundingBox()
  const button = await profile.boundingBox()
  expect(button!.y).toBeLessThan(logo!.y + logo!.height)
  expect(button!.x + button!.width).toBeLessThanOrEqual(320)
})

test('mobile feed captions open the detail, with independent reactions and desktop text', async ({ page }) => {
  const card = page.getByRole('article').first()
  const caption = card.locator('.post-caption')
  const text = await caption.innerText()
  const link = card.getByRole('link', { name: text, exact: true })
  await expect(link).toHaveAttribute('href', '/community/posts/1')
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await card.getByRole('button', { name: '공감 24' }).tap()
  await expect(card.getByRole('button', { name: '공감 25' })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: '댓글 0개' }).tap()
  await expect(card.getByRole('button', { name: '댓글 0개' })).toHaveAttribute('aria-expanded', 'true')
  await link.tap()
  await expect(page).toHaveURL(/\/community\/posts\/1$/)
  await expect(caption).toHaveText(text)
  await expect(link).toHaveCount(0)
  await page.goBack()
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(caption).toHaveText(text)
  await expect(link).toHaveCount(0)
  await expect(card.getByRole('link', { name: '글 보기' })).toBeVisible()
})
