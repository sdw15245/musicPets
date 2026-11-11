import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

for (const member of [false, true]) {
  test(`mobile composer appears only after the main action scrolls away (${member ? 'member' : 'guest'})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    if (member) await signedInPreview(page)
    await mockPlayers(page)
    await page.goto('/community')
    const main = page.getByRole('button', { name: '오늘의 한 곡 올리기', exact: true })
    const floating = page.getByRole('button', { name: '빠르게 한 곡 올리기', exact: true })
    await expect(main).toBeInViewport()
    await expect(floating).toBeHidden()
    await page.evaluate(() => window.scrollTo(0, 650))
    await expect(floating).toBeVisible()
    await floating.click()
    const dialog = page.getByRole(member ? 'dialog' : 'alertdialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(floating).toBeFocused()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(main).toBeInViewport()
    await expect(floating).toBeHidden()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 650))
    await expect(floating).toBeHidden()
  })
}

test('visitors see blurred undiscovered pets while detailed stories stay locked', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('button', { name: '멜로 자세히 보기', exact: true })
  await card.scrollIntoViewIfNeeded()
  await expect(card.getByRole('img', { name: '멜로', exact: true })).toBeVisible()
  await expect(card.locator('img')).toHaveCSS('filter', /blur/)
  await expect(card).not.toContainText('아늑한 몽상가')
  await card.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('img', { name: '멜로', exact: true })).toBeVisible()
  await expect(dialog).toContainText('펫을 만나면 이야기가 열려요.')
  await expect(dialog).not.toContainText('멜로의 방에는')
})
