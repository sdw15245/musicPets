import type { Route } from '@playwright/test'
import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

for (const width of [390, 1280]) {
  for (const member of [false, true]) {
    test(`header preserves controls and positions during reload: width=${width}, member=${member}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockAuth(page, member ? 'member-access' : null)
      await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'header-test', displayName: '음악 친구', email: '' } }))
      await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
      await page.goto('/')
      const header = page.getByRole('banner')
      const account = member ? header.getByRole('button', { name: '프로필', exact: true }) : header.getByRole('link', { name: '로그인', exact: true })
      await expect(account).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const community = header.getByRole('link', { name: '커뮤니티', exact: true })
      const before = await community.boundingBox()
      let receive!: (route: Route) => void
      const held = new Promise<Route>(resolve => { receive = resolve })
      await page.route('**/api/auth/refresh', route => { receive(route) }, { times: 1 })
      const privateCalls: string[] = []
      page.on('request', request => { if (/\/api\/(me|analysis\/latest|notifications)/.test(request.url())) privateCalls.push(request.url()) })
      await page.reload()
      const request = await held
      await page.evaluate(() => document.fonts.ready)
      await expect(account).toBeVisible()
      if (member) {
        await expect(account).toBeDisabled()
        await expect(header.getByRole('link', { name: '내 취향', exact: true })).toBeVisible()
        await expect(header.getByRole('link', { name: '로그인', exact: true })).toHaveCount(0)
      } else {
        await expect(header.getByRole('button', { name: '이용 방법', exact: true })).toBeVisible()
        await expect(header.getByRole('button', { name: '캐릭터', exact: true })).toBeVisible()
      }
      const after = await community.boundingBox()
      expect(Math.abs(after!.x - before!.x)).toBeLessThan(2)
      expect(Math.abs(after!.y - before!.y)).toBeLessThan(2)
      expect(privateCalls).toEqual([])
      await page.screenshot({ path: `test-results/header-${width}-${member}.png` })
      await request.fulfill(member ? { json: { access: 'member-access' } } : { status: 401 })
      await expect(account).toBeEnabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}


for (const response of ['expired', 'unavailable']) {
  test(`a remembered member does not bypass an ${response} session`, async ({ page }) => {
    await mockAuth(page, 'member-access')
    await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'header-test', displayName: '음악 친구', email: '' } }))
    await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
    await page.route('**/api/auth/refresh', route => route.fulfill({ status: response === 'expired' ? 401 : 503 }))
    await page.reload()
    await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toHaveCount(0)
    const hint = await page.evaluate(() => sessionStorage.getItem('musicpets-header-view-v1'))
    if (response === 'unavailable') expect(hint).toBeNull()
    else expect(JSON.parse(hint!)).toMatchObject({ member: false })
  })
}

for (const value of ['{', JSON.stringify({ member: true, savedAt: 0 }), JSON.stringify({ member: 'true', savedAt: 1_800_000_000_000 })]) {
  test(`invalid header hints are ignored: ${value}`, async ({ page }) => {
    await page.addInitScript(value => sessionStorage.setItem('musicpets-header-view-v1', value), value)
    let receive!: (route: Route) => void
    const held = new Promise<Route>(resolve => { receive = resolve })
    await page.route('**/api/auth/refresh', route => { receive(route) }, { times: 1 })
    await page.goto('/')
    const request = await held
    await expect(page.getByRole('banner').getByRole('link', { name: '커뮤니티', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '프로필', exact: true })).toHaveCount(0)
    await request.fulfill({ status: 401 })
    await expect(page.getByRole('banner').getByRole('link', { name: '로그인', exact: true })).toBeVisible()
  })
}
