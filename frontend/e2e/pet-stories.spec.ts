import { expect, test } from './test'
import { mockAuth } from './auth-fixture'
import characters from '../../shared/characters.json' with { type: 'json' }

test.beforeEach(async ({ page }) => {
  await mockAuth(page, 'test-access')
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'pet-test', displayName: '음악 친구', email: '', unlockedCharacters: ['mochi'],
  } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
})

test('collection portraits stay anchored when a story opens and closes', async ({ page }, info) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto('/pets')
    const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '멜로', exact: true }) })
    await expect(row).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const offsets = () => page.locator('.pet-collection-row > img').evaluateAll(images => images.map(image =>
      image.getBoundingClientRect().top - image.parentElement!.getBoundingClientRect().top))
    const before = await offsets()
    await row.getByText('펫 이야기', { exact: true }).click()
    await expect(row.getByText(characters[0].story, { exact: true })).toBeVisible()
    const open = await offsets()
    open.forEach((top, index) => expect(Math.abs(top - before[index])).toBeLessThanOrEqual(1))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`pets-open-${width}.png`), fullPage: true })
    await row.getByText('펫 이야기', { exact: true }).click()
    expect(await offsets()).toEqual(before)
  }
})

test('unmet pet stories are unavailable in the collection and landing details', async ({ page }) => {
  await page.goto('/pets')
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '루바', exact: true }) })
  await expect(row).toBeVisible()
  await expect(row.getByText('펫 이야기', { exact: true })).toHaveCount(0)
  await expect(row.getByText(characters[1].story, { exact: true })).toHaveCount(0)
  await expect(row).toContainText('펫을 만나면 이야기가 열려요.')
  await page.goto('/')
  await page.getByRole('button', { name: '루바 자세히 보기', exact: true }).click()
  const locked = page.getByRole('dialog', { name: '루바', exact: true })
  await expect(locked.getByText(characters[1].story, { exact: true })).toHaveCount(0)
  await expect(locked).toContainText('펫을 만나면 이야기가 열려요.')
  await locked.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '멜로 자세히 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '멜로', exact: true }).getByText(characters[0].story, { exact: true })).toBeVisible()
})
