import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test.beforeEach(async ({ page }) => { await signedInPreview(page); await mockPlayers(page) })

test('filter selection stays independent of entered tags', async ({ page }) => {
  await page.goto('/community')
  const all = page.getByRole('radio', { name: '전체 음악', exact: true })
  await all.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: '나와 같은 펫', exact: true })).toBeChecked()
  await expect(page.getByRole('article').filter({ hasText: '리듬산책' })).toHaveCount(0)
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const tag = page.getByRole('textbox', { name: '태그', exact: true })
  await tag.fill('밤산책')
  await tag.press('Enter')
  await expect(page.getByRole('button', { name: '#밤산책 삭제' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '작성 취소하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: '나와 같은 펫', exact: true })).toBeChecked()
})

test('personal feeds can return to all music through the header at every screen size', async ({ page }) => {
  for (const width of [1280, 768, 767, 360]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/community?view=mine')
    await expect(page.getByRole('heading', { name: '내 글', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '내 프로필', exact: true })).toBeVisible()
    const allMusic = page.getByRole('link', { name: '커뮤니티', exact: true })
    await allMusic.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
    await expect(page.getByRole('button', { name: '오늘의 한 곡 올리기' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('draft survives dismissal and responsive dialog changes until explicitly discarded', async ({ page }, testInfo) => {
  await page.goto('/community')
  const trigger = page.getByRole('button', { name: '오늘의 한 곡 올리기' })
  await trigger.click()
  await page.getByRole('textbox', { name: '곡 검색' }).fill('seasons')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByRole('button', { name: 'seasons — wave to earth' }).click()
  const caption = page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })
  await caption.fill('산책하며 듣고 싶은 곡이에요.\n'.repeat(12))
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: '계속 작성하기' }).click()
  await expect(caption).toHaveValue(/산책하며/)
  await page.setViewportSize({ width: 360, height: 740 })
  await expect(caption).toHaveValue(/산책하며/)
  await expect(page.getByRole('dialog', { name: '오늘의 한 곡', exact: true })).toHaveClass(/seed-bottom-sheet/)
  const sheet = page.getByRole('dialog', { name: '오늘의 한 곡', exact: true })
  const bounds = await sheet.boundingBox()
  expect(bounds?.height).toBeLessThanOrEqual(740 * 0.9 + 1)
  await page.addStyleTag({ content: 'html { font-size: 150%; }' })
  await page.getByRole('button', { name: '공유하기', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: '공유하기', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('composer-mobile-scaled.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: '작성 취소하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(caption).toHaveValue('')
})

test('composer closes with focus restoration and resets drafts in reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/community')
  const trigger = page.getByRole('button', { name: '오늘의 한 곡 올리기' })
  for (const content of ['', '폐기할 초안']) {
    await trigger.click()
    if (content) await page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill(content)
    await page.getByRole('button', { name: '취소', exact: true }).click()
    if (content) await page.getByRole('button', { name: '작성 취소하기', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
  await trigger.click()
  await expect(page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })).toHaveValue('')
})

test('SEED text scaling enlarges content without horizontal page overflow', async ({ page }, testInfo) => {
  for (const route of ['/', '/login', '/community']) {
    await page.goto(route)
    // The route shell can show its title before the community module and styles are ready.
    if (route === '/community') await expect(page.getByPlaceholder('글 내용·태그 검색')).toBeVisible()
    const title = page.getByRole('heading', { level: 1 }).first()
    const size = await title.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    await page.addStyleTag({ content: 'html { font-size: 150%; }' })
    expect(await title.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(size * 1.3)
    for (const width of [1280, 768, 360]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath(`scaled-${route.slice(1) || 'landing'}.png`), fullPage: true })
  }
})

test('failed author images show a fallback without losing the author identity', async ({ page }) => {
  await page.route('**/characters/**', route => route.abort())
  await page.goto('/community')
  const post = page.getByRole('article', { name: '초록밤의 음악 공유' })
  await expect(post).toContainText('초록밤')
  await expect(post.locator('.seed-avatar__fallback')).toBeVisible()
  await expect(post.getByRole('button', { name: '공감 24', exact: true })).toBeEnabled()
})

test('dirty drafts warn before document navigation and keep their text on cancellation', async ({ page }) => {
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const caption = page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })
  await caption.fill('아직 작성 중인 이야기')
  const dialogEvent = page.waitForEvent('dialog')
  // A cancelled navigation never reaches a load event; bound that wait separately.
  const reload = page.reload({ timeout: 2000 }).catch(() => null)
  const warning = await dialogEvent
  expect(warning.type()).toBe('beforeunload')
  await warning.dismiss()
  await expect(caption).toHaveValue('아직 작성 중인 이야기')
  await reload
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '작성 취소하기', exact: true }).click()
})

