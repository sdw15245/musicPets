import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test.beforeEach(async ({ page }) => {
  // Verify our integration without depending on Spotify playback availability.
  await mockPlayers(page)
})

test('Enter creates removable tags without submitting, and tags and player persist', async ({ page }) => {
  await signedInPreview(page)
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await page.getByRole('textbox', { name: '곡 검색' }).fill('seasons')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByRole('button', { name: 'seasons — wave to earth' }).click()
  await page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('새 태그와 함께 공유해요.')
  const input = page.getByRole('textbox', { name: '태그', exact: true })
  await input.fill('a')
  await input.press('Enter')
  await expect(page.getByRole('dialog', { name: '오늘의 한 곡', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '#a 삭제' })).toBeVisible()
  await input.fill('#a')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: '#a 삭제' })).toHaveCount(1)
  await input.fill('밤산책')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await expect(page.getByRole('button', { name: '#밤산책 삭제' })).toHaveCount(0)
  await input.press('Enter')
  await page.getByRole('button', { name: '#a 삭제' }).click()
  await input.fill('휴식')
  await page.getByRole('button', { name: '공유하기', exact: true }).click()
  await expect(page.getByText('입력한 태그를 추가 버튼이나 Enter로 추가하거나 지워주세요.', { exact: true })).toBeVisible()
  await expect(input).toBeFocused()
  await expect(page.getByRole('dialog', { name: '오늘의 한 곡', exact: true })).toBeVisible()
  await input.press('Enter')
  await page.getByRole('button', { name: '공유하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  const post = page.getByRole('article').filter({ hasText: '새 태그와 함께 공유해요.' })
  await expect(post.locator('.post-tag')).toHaveText(['#밤산책', '#휴식'])
  await expect(post.locator('iframe')).toHaveAttribute('src', 'https://open.spotify.com/embed/track/5VBjyOQzqlPNgdRPMM6prF')
  await expect(post.locator('iframe')).toHaveAttribute('title', 'seasons Spotify 플레이어')
})

test('legacy local posts are not displayed as server posts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('community-preview', JSON.stringify({ version: 0, state: { sessions: { guest: {
    liked: [], saved: [], posts: [{ id: 'legacy', author: '나', petSlug: null,
      track: { name: '옛 곡', artist: '가수', uri: '', imageUrl: '', color: 'forest' },
      caption: '이전 기록', tag: '산책', createdAt: '2026-10-07T00:00:00Z', likes: 0, own: true }],
  } } } })))
  await page.goto('/community')
  const post = page.getByRole('article').filter({ hasText: '이전 기록' })
  await expect(post).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(5)
})

