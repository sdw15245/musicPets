import type { Route } from '@playwright/test'
import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

test('result reload keeps its header and tabs through auth and data loading', async ({ page }, info) => {
  await signedInPreview(page)
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '아직 분석한 취향이 없어요' })).toBeVisible()
  let auth!: (route: Route) => void
  let latest!: (route: Route) => void
  const authPending = new Promise<Route>(resolve => { auth = resolve })
  const latestPending = new Promise<Route>(resolve => { latest = resolve })
  await page.route('**/api/auth/refresh', route => auth(route), { times: 1 })
  await page.route('**/api/analysis/latest', route => latest(route), { times: 1 })
  const reads: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (['/api/me', '/api/analysis/latest', '/api/notifications/unread-count'].includes(path)) reads.push(path)
  })
  await page.reload()
  const authRequest = await authPending
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: '내 취향', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '분석 기록', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '아직 분석한 취향이 없어요' })).toHaveCount(0)
  expect(reads).toEqual([])
  const before = await page.getByRole('heading', { name: '내 취향', exact: true }).boundingBox()
  await page.screenshot({ path: info.outputPath('result-auth-desktop.png') })
  await authRequest.fulfill({ json: { access: 'preview-access' } })
  const latestRequest = await latestPending
  await expect(page.locator('.result-skeleton')).toBeVisible()
  expect(await page.getByRole('heading', { name: '내 취향', exact: true }).boundingBox()).toEqual(before)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: info.outputPath('result-data-mobile.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await latestRequest.fulfill({ status: 204 })
  await expect(page.getByRole('heading', { name: '아직 분석한 취향이 없어요' })).toBeVisible()
})

test('session failure keeps navigation and retries without exposing a protected page', async ({ page }) => {
  await signedInPreview(page)
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 503 }), { times: 1 })
  await page.goto('/history')
  await expect(page.getByRole('alert')).toContainText('로그인 정보를 확인하지 못했어요.')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: '분석 기록', exact: true })).toBeVisible()
  await page.route('**/api/analysis/history', route => route.fulfill({ json: [] }))
  await page.getByRole('button', { name: '다시 확인하기' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page).toHaveURL('/history')
})
