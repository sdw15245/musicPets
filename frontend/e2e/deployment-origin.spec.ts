import { expect, test } from './test'

test('session requests and Spotify login use the configured backend origin', async ({ page, baseURL }, testInfo) => {
  const origin = testInfo.config.metadata.backendOrigin || baseURL
  const sessionRequest = page.waitForRequest('**/api/auth/csrf')
  await page.goto('/login')
  expect(new URL((await sessionRequest).url()).origin).toBe(origin)

  await page.route('**/oauth2/authorization/spotify', route =>
    route.fulfill({ contentType: 'text/html', body: 'OAuth entry reached' }))
  await page.getByRole('button', { name: 'Spotify로 계속하기', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/oauth2/authorization/spotify`)
})
