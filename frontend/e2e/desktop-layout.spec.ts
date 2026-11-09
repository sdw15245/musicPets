import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test('PC windows keep the feed, keyboard focus and dialog actions accessible', async ({ page }, testInfo) => {
  await signedInPreview(page)
  await mockPlayers(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [1280, 600]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/community')
    await expect(page.getByRole('complementary', { name: '음악 취향 안내' })).toBeVisible()
    await expect(page.getByRole('link', { name: '커뮤니티', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const trigger = page.getByRole('button', { name: '오늘의 한 곡 올리기' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '오늘의 한 곡', exact: true })
    await expect(dialog).toHaveClass(/seed-dialog__content/)
    await expect(dialog).toBeFocused()
    const cancel = dialog.getByRole('button', { name: '취소', exact: true })
    const share = dialog.getByRole('button', { name: '공유하기', exact: true })
    await expect(cancel).toBeInViewport()
    await expect(share).toBeInViewport()
    const actionTops = await dialog.getByRole('button', { name: /^(취소|공유하기)$/ }).evaluateAll(
      buttons => buttons.map(button => button.getBoundingClientRect().top),
    )
    expect(Math.abs(actionTops[0] - actionTops[1])).toBeLessThan(2)
    for (let tab = 0; tab < 16; tab++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('composer-pc-1440.png'), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('community-pc-1440.png'), animations: 'disabled' })
  }
  expect(errors).toEqual([])
})
