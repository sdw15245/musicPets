import { expect, test, type Page } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { mockAuth } from './auth-fixture'

function token(user: number) {
  return `header.${Buffer.from(JSON.stringify({ sub: String(user) })).toString('base64url')}.signature`
}

async function signIn(page: Page, user: number) {
  await mockAuth(page, token(user))
  await page.reload()
}

test('recent searches persist, reorder without duplicates, search again and support deletion and dismissal', async ({ page }, info) => {
  test.slow()
  await signedInPreview(page)
  await mockPlayers(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/community')
  await signIn(page, 1)
  const input = page.getByRole('textbox', { name: '본문 또는 태그 검색' })
  const history = page.getByRole('dialog', { name: '최근 검색어', exact: true })
  await input.click()
  await expect(history).toContainText('최근 검색어가 없어요.')
  await expect(input).toBeFocused()
  await input.fill('입력만 한 단어')
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await input.click()
  await expect(history).toContainText('최근 검색어가 없어요.')
  for (const query of ['출근길', '#산책', '차분한', '산책']) {
    await input.fill(query)
    await input.press('Enter')
    await expect(history).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: '검색 결과' })).toContainText(`‘${query.replace(/^#/, '')}’ 검색 결과`)
  }
  await page.reload()
  await input.click()
  await expect(history.getByRole('listitem')).toHaveText(['산책', '차분한', '출근길'])
  await page.screenshot({ path: info.outputPath('recent-searches-desktop.png') })
  await history.getByRole('button', { name: '최근 검색어 출근길 검색', exact: true }).click()
  await expect(input).toHaveValue('출근길')
  await expect(input).toBeFocused()
  await expect(history).toBeHidden()
  await expect(page.getByRole('article')).toHaveCount(1)
  await input.click()
  await expect(history.getByRole('listitem')).toHaveText(['출근길', '산책', '차분한'])
  await history.getByRole('button', { name: '최근 검색어 산책 삭제', exact: true }).click()
  await expect(history.getByRole('listitem')).toHaveText(['출근길', '차분한'])
  await expect(page.getByRole('status').filter({ hasText: '검색 결과' })).toContainText('‘출근길’ 검색 결과')
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await input.click()
  await page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' }).click()
  await expect(history).toBeHidden()
  await input.click()
  const clearAll = history.getByRole('button', { name: '전체 삭제' })
  for (let step = 0; step < 4; step++) {
    await page.keyboard.press('Tab')
    if (await clearAll.evaluate(element => element === document.activeElement)) break
  }
  await expect(clearAll).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await expect(input).toBeFocused()
  await input.click()
  await page.setViewportSize({ width: 360, height: 900 })
  await expect(history).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('recent-searches-mobile.png') })
  await history.getByRole('button', { name: '전체 삭제' }).click()
  await expect(history).toContainText('최근 검색어가 없어요.')
  await page.reload()
  await input.click()
  await expect(history.getByRole('listitem')).toHaveCount(0)
})

test('recent searches stay private to each account and guests can search without recording history', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 204 }))
  await page.goto('/community')
  await signIn(page, 1)
  const input = page.getByRole('textbox', { name: '본문 또는 태그 검색' })
  const history = page.getByRole('dialog', { name: '최근 검색어', exact: true })
  await input.fill('산책')
  await input.press('Enter')
  await page.getByRole('button', { name: '프로필', exact: true }).click()
  await page.getByRole('menuitem', { name: '로그아웃', exact: true }).click()
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toHaveCount(0)
  await input.click()
  await expect(history).toHaveCount(0)
  await input.fill('출근길')
  await input.press('Enter')
  await expect(page.getByRole('article')).toHaveCount(1)
  await signIn(page, 2)
  await input.click()
  await expect(history).toContainText('최근 검색어가 없어요.')
  await input.fill('차분한')
  await input.press('Enter')
  await input.click()
  await expect(history.getByRole('listitem')).toHaveText(['차분한'])
  await signIn(page, 1)
  await input.click()
  await expect(history.getByRole('listitem')).toHaveText(['산책'])
})

test('recent history keeps only the ten latest searches and long terms fit within the panel', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.goto('/community')
  const input = page.getByRole('textbox', { name: '본문 또는 태그 검색' })
  const history = page.getByRole('dialog', { name: '최근 검색어', exact: true })
  const longTerm = '아주긴검색어'.repeat(15)
  for (const query of [...Array.from({ length: 10 }, (_, index) => `검색${index}`), longTerm]) {
    await input.fill(query)
    await input.press('Enter')
    await expect(page).toHaveURL(url => url.searchParams.get('q') === query)
    // The address changes before React commits the result; wait for the visible search state.
    await expect(page.getByRole('status').filter({ hasText: '검색 결과' })).toContainText(`‘${query}’ 검색 결과`)
  }
  await expect(page).toHaveURL(url => url.searchParams.get('q') === longTerm)
  await input.click()
  await expect(history.getByRole('listitem')).toHaveCount(10)
  await expect(history.getByRole('button', { name: '최근 검색어 검색0 검색', exact: true })).toHaveCount(0)
  await expect(history.getByRole('listitem').first()).toHaveText(longTerm)
  for (const scale of [100, 150]) {
    await page.addStyleTag({ content: `html { font-size: ${scale}%; }` })
    for (const width of [1280, 768, 360]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(history).toBeInViewport()
      expect(await history.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
