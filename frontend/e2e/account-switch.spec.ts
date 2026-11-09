import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'spotify-original', displayName: 'Spotify 이름', nickname: '커뮤니티 이름', email: '',
  } }))
  await page.route('**/api/posts?**', route => route.fulfill({ json: { items: [], page: 0, hasMore: false } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/oauth2/authorization/spotify?**', route => route.fulfill({ contentType: 'text/html', body: 'OAuth test' }))
})

test('guest can find account switching and keeps their destination', async ({ page }, info) => {
  await page.goto('/login?next=%2Fcommunity%3Fview%3Dmine')
  await page.getByRole('link', { name: '다른 계정으로 로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Spotify 계정 변경' })).toBeVisible()
  const spotify = page.getByRole('link', { name: 'Spotify 웹사이트 열기' })
  await expect(spotify).toHaveAttribute('href', 'https://www.spotify.com/account/')
  await expect(spotify).toHaveAttribute('target', '_blank')
  await page.setViewportSize({ width: 360, height: 800 })
  await expect(page.getByRole('button', { name: '변경한 계정으로 계속하기' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('account-switch-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: '변경한 계정으로 계속하기' }).click()
  await expect(page).toHaveURL(/\/oauth2\/authorization\/spotify\?switch_account=true$/)
  await mockAuth(page, 'new-account-access')
  await page.goto('/oauth/callback')
  await expect(page).toHaveURL('http://127.0.0.1:5178/community?view=mine')
})

test('profile shows Spotify identity separately and opening or cancelling does not log out', async ({ page }, info) => {
  await mockAuth(page, 'account-access')
  let logouts = 0
  await page.route('**/api/auth/logout', route => { logouts++; return route.fulfill({ status: 204 }) })
  await page.goto('/mypage')
  await expect(page.getByText('spotify-original', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '계정 변경', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Spotify 계정 변경' })).toBeVisible()
  await expect(page.getByText('spotify-original', { exact: true })).toBeVisible()
  expect(logouts).toBe(0)
  await page.screenshot({ path: info.outputPath('account-switch-desktop.png'), fullPage: true })
  await page.getByRole('link', { name: '취소', exact: true }).click()
  await expect(page).toHaveURL(/\/mypage$/)
  expect(logouts).toBe(0)
  await page.getByRole('link', { name: '계정 변경', exact: true }).click()
  await page.getByRole('button', { name: '변경한 계정으로 계속하기' }).click()
  await expect(page).toHaveURL(/\/oauth2\/authorization\/spotify\?switch_account=true$/)
  expect(logouts).toBe(1)
})

test('failed logout keeps the account and does not start OAuth', async ({ page }) => {
  await mockAuth(page, 'account-access')
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 500 }))
  await page.goto('/login?switchAccount=true')
  await page.getByRole('button', { name: '변경한 계정으로 계속하기' }).click()
  await expect(page.getByRole('alert')).toContainText('로그아웃하지 못했어요')
  await expect(page).toHaveURL(/\/login\?switchAccount=true$/)
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
})

test('cancelled Spotify approval returns to account switching', async ({ page }) => {
  await page.goto('/login?switchAccount=true&next=%2Fresult')
  await page.getByRole('button', { name: '변경한 계정으로 계속하기' }).click()
  await expect(page).toHaveURL(/switch_account=true$/)
  await page.goto('/login?oauthError=spotify')
  await expect(page.getByRole('heading', { name: 'Spotify 계정 변경' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Spotify 연결을 완료하지 못했어요')
  await page.getByRole('link', { name: '취소', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'MusicPets 로그인' })).toBeVisible()
})
