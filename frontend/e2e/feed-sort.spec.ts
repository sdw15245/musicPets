import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { samplePosts } from './community-data'

test('sort menu keeps focus on its trigger when Escape precedes the opening animation frame', async ({ page }, info) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.goto('/community')
  const trigger = page.getByRole('button', { name: '정렬: 최신글', exact: true })
  await trigger.focus()
  await expect(trigger).toBeFocused()
  const now = new Date()
  await page.clock.install({ time: now })
  // install starts the clock running; pause ahead of it, before opening the menu.
  await page.clock.pauseAt(new Date(now.getTime() + 60_000))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.clock.runFor(500)
  await expect(page.getByRole('menu')).toBeHidden()
  const state = await trigger.evaluate(element => ({ focused: document.activeElement === element, documentFocused: document.hasFocus(), active: document.activeElement?.outerHTML }))
  await info.attach('early-close-focus', { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
  await expect(trigger).toBeFocused()
})

test('sort menu requests separately paginated server order and preserves keyboard and mobile access', async ({ page }, info) => {
  await signedInPreview(page)
  await mockPlayers(page)
  const reads: string[] = []
  await page.route(/\/api\/posts\?/, route => {
    const params = new URL(route.request().url()).searchParams
    const sort = params.get('sort')
    const pageNo = Number(params.get('page'))
    reads.push(`${sort}:${pageNo}`)
    const latest = [
      { ...samplePosts[0], id: '3', author: '최신글작성자', likes: 0 },
      { ...samplePosts[0], id: '2', author: '이전글작성자', likes: 0 },
      { ...samplePosts[0], id: '1', author: '오래된인기글', likes: 3 },
    ]
    const rows = sort === 'popular' ? [latest[2], latest[0], latest[1]] : latest
    return route.fulfill({ json: { items: rows.slice(pageNo * 2, (pageNo + 1) * 2), page: pageNo, hasMore: pageNo === 0 } })
  })
  // Establish the member profile before counting sort/pagination requests.
  // Restoring a session on the feed legitimately refetches its guest cache.
  await page.goto('/')
  await page.getByRole('button', { name: '프로필', exact: true }).click()
  await expect(page.locator('.landing-account-name')).toHaveText('음악 친구')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: '커뮤니티', exact: true }).first().click()
  const authors = page.locator('.post-byline strong')
  await expect(authors).toHaveText(['최신글작성자', '이전글작성자'])
  await page.getByRole('button', { name: '음악 더 보기' }).click()
  await expect(authors).toHaveText(['최신글작성자', '이전글작성자', '오래된인기글'])
  const trigger = page.getByRole('button', { name: '정렬: 최신글', exact: true })
  await trigger.click()
  await expect(page.getByRole('menuitem')).toHaveCount(2)
  await expect(page.getByRole('menuitem', { name: '최신글', exact: true })).toHaveAttribute('aria-current', 'true')
  await page.screenshot({ path: info.outputPath('feed-sort-desktop.png') })
  await page.getByRole('menuitem', { name: '인기글(공감순)', exact: true }).click()
  await expect(authors).toHaveText(['오래된인기글', '최신글작성자'])
  expect(reads).toEqual(['latest:0', 'latest:1', 'popular:0'])
  await page.getByRole('button', { name: '음악 더 보기' }).click()
  await expect(authors).toHaveText(['오래된인기글', '최신글작성자', '이전글작성자'])
  await page.getByRole('button', { name: '정렬: 인기글(공감순)', exact: true }).click()
  await page.getByRole('menuitem', { name: '최신글', exact: true }).click()
  await expect(authors).toHaveText(['최신글작성자', '이전글작성자', '오래된인기글'])
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(trigger).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
