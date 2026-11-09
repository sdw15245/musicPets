import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { mockAuth } from './auth-fixture'

test('likes wait for the API, preserve the count on failure, persist after reload, and cancel', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  let calls = 0
  let fail = true
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/posts/1/like', async route => {
    calls++
    if (fail) return route.fulfill({ status: 500, json: {} })
    if (route.request().method() === 'PUT') await pending
    return route.fallback()
  })
  // Old local-only likes must not inflate the server's count or appear as saved likes.
  await page.addInitScript(() => localStorage.setItem('community-preview', JSON.stringify({ version: 0, state: { sessions: {
    'user:1': { posts: [], liked: ['1'], saved: [], comments: [] },
  } } })))
  await page.goto('/community')
  const post = page.getByRole('article', { name: '초록밤의 음악 공유' })
  const button = post.getByRole('button', { name: '공감 24', exact: true })
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await button.click()
  await expect(page.getByRole('alert')).toContainText('공감을 변경하지 못했어요')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  fail = false
  await button.click()
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('data-loading')
  const otherPost = page.getByRole('article', { name: '리듬산책의 음악 공유' })
  const otherLike = otherPost.getByRole('button', { name: /^공감 / })
  await expect(otherLike).toBeEnabled()
  await otherLike.click()
  await expect(otherPost.getByRole('button', { name: '공감 33', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(button).toBeDisabled()
  expect(calls).toBe(2)
  release()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await post.getByRole('button', { name: '공감 25', exact: true }).click()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  expect(calls).toBe(3)
})

test('popular order is refreshed after a like and another account sees the count without owning the like', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.goto('/community')
  const post = page.getByRole('article', { name: '초록밤의 음악 공유' })
  await post.getByRole('button', { name: '공감 24', exact: true }).click()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '정렬: 최신글' }).click()
  await page.getByRole('menuitem', { name: '인기글(공감순)' }).click()
  await expect(page.locator('.post-byline strong').first()).toHaveText('리듬산책')
  await mockAuth(page, 'other-access')
  await page.reload()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'false')
})
