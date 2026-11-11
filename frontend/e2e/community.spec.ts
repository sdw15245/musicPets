import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { mockAuth } from './auth-fixture'

test.beforeEach(async ({ page }) => {
  await mockPlayers(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
})

test('public feed only reads the posts API', async ({ page }, testInfo) => {
  const apiCalls: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) apiCalls.push(request.url())
  })
  await page.goto('/community')
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(보관한 음악|내가 공유한 곡)$/ })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('community-desktop.png'), fullPage: true })
  await expect(page.getByRole('radio', { name: '나와 같은 펫', exact: true })).toBeDisabled()
  await expect(page.getByRole('radio', { name: '다른 펫', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('로그인하고 함께해요')
  await page.getByRole('button', { name: '계속 둘러보기' }).click()
  await page.getByRole('button', { name: '공감 24', exact: true }).first().click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  expect(apiCalls.length).toBeGreaterThan(0)
  expect(apiCalls.every(url => new URL(url).pathname === '/api/posts')).toBe(true)
})

test('selecting a song and sharing persists through the API and the author can delete it', async ({ page }) => {
  await signedInPreview(page)
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '곡 검색' }).fill('seasons')
  await dialog.getByRole('button', { name: '검색', exact: true }).click()
  await dialog.getByRole('button', { name: 'seasons — wave to earth' }).click()
  await dialog.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('   ')
  await expect(dialog.getByRole('button', { name: '공유하기', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('비 오는 날 함께 듣고 싶은 노래예요.')
  await dialog.getByRole('button', { name: '공유하기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('article').first()).toContainText('비 오는 날 함께 듣고 싶은 노래예요.')
  await page.reload()
  const post = page.getByRole('article').filter({ hasText: '비 오는 날 함께 듣고 싶은 노래예요.' })
  await expect(post).toBeVisible()
  await post.getByRole('button', { name: '내 글 삭제' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제 확인' }).click()
  await expect(post).toHaveCount(0)
})


test('composer is keyboard accessible and community fits a mobile screen', async ({ page }, testInfo) => {
  await signedInPreview(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '오늘의 한 곡 올리기', exact: true })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('community-mobile.png'), fullPage: true })
})

test('an actual analysis recommendation and pet carry into the share composer', async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'music-friend', displayName: '음악 친구', email: '', analyzedPet: 'pip' } }))
  await mockAuth(page, 'test-access')
  let calls = 0
  await page.route('**/api/analysis', route => {
    calls++
    return route.fulfill({ json: {
      id: 'community-analysis', analyzedAt: '2026-09-30T00:00:00Z',
      genres: { vector: { pop: 1 }, unmappedTags: [], tagCount: 1, trackCount: 1 },
      character: { slug: 'pip', name: '루바', description: '신난 장난꾸러기', imageUrl: '/characters/pip.png', score: 0.9 },
      profile: { mainstream: 60, obscurity: 40, comment: '경쾌한 음악 취향' },
      recommendations: [{ name: '나의 추천곡', artist: '추천 아티스트', uri: 'spotify:track:5VBjyOQzqlPNgdRPMM6prF', imageUrl: '' }],
      recommendationsAvailable: true, warnings: [],
    } })
  })
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  const titleBox = await page.getByText('나의 추천곡', { exact: true }).boundingBox()
  const shareBox = await page.getByRole('link', { name: '나의 추천곡 이 곡으로 글 쓰기' }).boundingBox()
  expect(shareBox!.x).toBeGreaterThanOrEqual(titleBox!.x)
  await page.getByRole('link', { name: '나의 추천곡 이 곡으로 글 쓰기' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('나의 추천곡')
  await expect(dialog.getByRole('img', { name: '루바' })).toBeVisible()
  await dialog.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('추천받은 곡을 공유해요.')
  await dialog.getByRole('button', { name: '공유하기', exact: true }).click()
  const published = page.getByRole('article').first()
  await expect(published).toContainText('추천받은 곡을 공유해요.')
  await expect(published.locator('.post-byline').getByText('나', { exact: true })).toBeVisible()
  await expect(published.locator('.post-byline').getByText('루바', { exact: true })).toHaveCount(0)
  expect(calls).toBe(1)
})

test('obsolete preview storage and saved URLs do not affect the server feed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('community-preview', '{broken-json'))
  await signedInPreview(page)
  await page.goto('/community?view=saved')
  await expect(page.getByRole('heading', { name: '오늘, 어떤 음악 들었어요?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /스크랩/ })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('article').filter({ hasText: '초록밤' })).toBeVisible()
})
