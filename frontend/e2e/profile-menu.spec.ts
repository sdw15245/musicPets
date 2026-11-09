import { expect, test } from './test'
import { mockCommunity } from './community-fixture'
import { mockAuth } from './auth-fixture'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
})

test('mypage without a result does not start analysis and routes to my posts without a scrap shortcut', async ({ page }) => {
  await mockCommunity(page)
  await mockAuth(page, 'test-access')
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'sample', displayName: 'Sample', email: '' } }))
  let calls = 0
  await page.route('**/api/analysis', route => { calls++; return route.abort() })
  await page.goto('/mypage')
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible()
  expect(calls).toBe(0)
  await expect(page.getByRole('link', { name: '스크랩' })).toHaveCount(0)
  await expect(page.getByText('아직 공유한 음악이 없어요', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '내 글 전체 보기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 글', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '내 음악 취향', exact: true })).toHaveCount(0)
})

test('profile menu supports dismissal, keyboard logout and narrow screens', async ({ page }, testInfo) => {
  await mockAuth(page, 'test-access')
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'test-admin', displayName: 'test-admin', email: '',
  } }))
  let logoutCalls = 0
  await page.route('**/api/auth/logout', route => {
    logoutCalls++
    return route.fulfill({ status: 204 })
  })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '프로필' })
  const menu = page.getByRole('menu', { name: '프로필' })
  await expect(page.getByRole('menuitem', { name: '로그아웃' })).toHaveCount(0)
  await trigger.click()
  await expect(menu).toContainText('test-admin')
  await page.screenshot({ path: testInfo.outputPath('profile-menu.png') })
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('h1').click()
  await expect(menu).toHaveCount(0)
  await page.setViewportSize({ width: 360, height: 800 })
  await trigger.click()
  await expect(menu).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('profile-menu-mobile.png') })
  await page.getByRole('menuitem', { name: '로그아웃' }).focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveCount(0)
  expect(logoutCalls).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('auth'))).toBeNull()
})
