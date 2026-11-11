import { expect, test } from './test'
import { signedInPreview } from './community-fixture'
import { samplePosts } from './community-data'

test('mypage reads the latest own posts, shows three previews and supports cancelling name edits', async ({ page }, info) => {
  await signedInPreview(page)
  const requests: URLSearchParams[] = []
  await page.route(/\/api\/posts\?/, route => {
    requests.push(new URL(route.request().url()).searchParams)
    return route.fulfill({ json: { items: samplePosts.map((post, index) => ({
      ...post, id: String(index + 1), own: true, author: '음악 친구', createdAt: '2026-10-10T00:00:00Z',
    })), page: 0, hasMore: false } })
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/mypage')
  const profile = page.getByRole('region', { name: '내 프로필', exact: true })
  await expect(profile.getByRole('heading', { name: '음악 친구', exact: true })).toBeVisible()
  await expect(profile.getByRole('img', { name: '분석 펫 프로필 사진' })).toHaveAttribute('src', '/characters/mochi.png')
  await expect(profile).toContainText('멜로')
  await expect(profile).not.toContainText('dream pop')
  const recent = page.getByRole('region', { name: '최근 내 글', exact: true })
  await expect(recent.getByRole('article')).toHaveCount(3)
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['Everything', 'Square (2017)', 'Dynamite'])
  expect(requests).toHaveLength(1)
  expect(requests[0].get('view')).toBe('mine')
  expect(requests[0].get('sort')).toBe('latest')
  expect(requests[0].get('page')).toBe('0')
  await expect(recent.getByRole('link', { name: 'Everything 글 보기' })).toHaveAttribute('href', '/community/posts/1')
  await expect(recent.getByRole('article').first().getByRole('link', { name: /Spotify에서 듣기/ })).toHaveAttribute('href', 'https://open.spotify.com/track/3QjI2bkcaQalyd1k0qvmYj')
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveCount(0)
  const profileBounds = await profile.boundingBox()
  const recentBounds = await recent.boundingBox()
  expect(recentBounds!.x).toBeGreaterThan(profileBounds!.x + profileBounds!.width)
  await page.screenshot({ path: info.outputPath('mypage-desktop.png'), fullPage: true })
  const trigger = page.getByRole('button', { name: '이름 수정', exact: true })
  await trigger.click()
  const name = page.getByRole('textbox', { name: '이름', exact: true })
  await expect(name).toBeFocused()
  await name.fill('저장하지 않은 이름')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(name).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(name).toHaveValue('음악 친구')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.setViewportSize({ width: 360, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('mypage-mobile.png'), fullPage: true })
  await page.addStyleTag({ content: 'html { font-size: 150%; }' })
  await trigger.click()
  await name.fill('아주긴이름'.repeat(6))
  for (const width of [1280, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `mypage at ${width}px`).toBe(true)
  }
})

test('failed own-post loading offers retry and only shows the empty state after a successful read', async ({ page }) => {
  await signedInPreview(page, null)
  let reads = 0
  await page.route(/\/api\/posts\?/, route => route.fulfill(++reads === 1
    ? { status: 500, json: { message: 'failed' } }
    : { json: { items: [], page: 0, hasMore: false } }))
  await page.goto('/mypage')
  await expect(page.getByRole('alert')).toContainText('내 글을 불러오지 못했어요.')
  await expect(page.getByText('아직 공유한 음악이 없어요', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '내 프로필', exact: true })).toContainText('아직 음악 펫을 만나기 전이에요.')
  await page.getByRole('button', { name: '내 글 다시 불러오기', exact: true }).click()
  await expect(page.getByText('아직 공유한 음악이 없어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(reads).toBe(2)
  await expect(page.getByRole('link', { name: '내 글 전체 보기', exact: true })).toHaveAttribute('href', '/community?view=mine')
})
