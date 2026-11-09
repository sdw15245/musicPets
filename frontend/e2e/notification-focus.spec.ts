import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

test.beforeEach(async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
})

test('reply notification shows context and opens the target thread beyond page zero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/notifications?*', route => route.fulfill({ json: {
    items: [{ id: '1', actor: '밤산책', avatarSlug: 'mochi', kind: 'REPLY', postId: '1', commentId: '101',
      postPreview: 'Everything · 검정치마', commentPreview: '그 앨범의 다른 곡도 좋아요.', createdAt: '2026-11-07T00:00:00Z', read: false }],
    page: 0, hasMore: false, unreadCount: 1,
  } }))
  await page.route('**/api/notifications/1/read', route => route.fulfill({ status: 204 }))
  await page.route('**/api/posts/1/comments?*', route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('focus')).toBe('101')
    return route.fulfill({ json: { page: 1, hasMore: false, items: [
      { id: '100', postId: '1', parentId: null, author: '음악 친구', avatarSlug: 'mochi', body: '다음 곡도 궁금해요.', createdAt: '2026-11-07T00:00:00Z', deleted: false, own: true },
      { id: '101', postId: '1', parentId: '100', author: '밤산책', avatarSlug: 'pip', body: '그 앨범의 다른 곡도 좋아요.', createdAt: '2026-11-07T00:01:00Z', deleted: false, own: false },
    ] } })
  })
  await page.goto('/notifications')
  const notification = page.locator('.notification-link')
  await expect(notification).toContainText('Everything · 검정치마')
  await expect(notification).toContainText('그 앨범의 다른 곡도 좋아요.')
  await notification.click()
  await expect(page).toHaveURL(/comment=101/)
  const target = page.locator('#comment-1-101')
  await expect(target).toBeFocused()
  await expect(target).toBeInViewport()
  await expect(target.locator('.comment-confirmation')).toHaveCount(1)
})

test('a deleted notification target explains the missing comment and can open the regular list', async ({ page }) => {
  await page.route('**/api/posts/1/comments?*', route => {
    if (new URL(route.request().url()).searchParams.has('focus')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ json: { page: 0, hasMore: false, items: [] } })
  })
  await page.goto('/community/posts/1?comments=1&comment=999')
  await expect(page.getByText('알림의 댓글을 찾을 수 없어요. 삭제된 댓글일 수 있어요.')).toBeVisible()
  await page.getByRole('link', { name: '전체 댓글 보기' }).click()
  await expect(page).toHaveURL(/\?comments=1$/)
  await expect(page.getByText('첫 댓글을 남겨보세요.')).toBeVisible()
})
