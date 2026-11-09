import { expect, test } from './test'
import { loginDestination } from '../src/features/auth/loginDestination'

test('login return paths preserve supported internal context and reject external destinations', () => {
  expect(loginDestination('/')).toBe('/')
  expect(loginDestination('/analyze')).toBe('/')
  expect(loginDestination('/result')).toBe('/result')
  expect(loginDestination('/community?view=mine&q=%EC%82%B0%EC%B1%85&sort=popular&filter=same&next=https://example.com')).toBe('/community?view=mine&q=%EC%82%B0%EC%B1%85&sort=popular&filter=same')
  for (const path of ['https://example.com/result', '//example.com/result', '/community/../result', '/result\\evil', '/unknown', null]) {
    expect(loginDestination(path)).toBe('/')
  }
})

test('OAuth failure gives user-facing recovery without assuming an account-registration issue', async ({ page }) => {
  await page.goto('/login?oauthError=spotify')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Spotify 연결을 완료하지 못했어요')
  await expect(alert).toContainText('다시 연결해주세요')
  await expect(alert).not.toContainText('Users Management')
  await expect(page.getByRole('button', { name: /Spotify로 계속하기/ })).toBeVisible()
})
