import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'

declare global {
  interface Window { musicPetsMotionEvents: string[] }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    window.musicPetsMotionEvents = []
    document.addEventListener('animationstart', event => window.musicPetsMotionEvents.push(event.animationName))
  })
})

test('the landing flow shows three connected steps and readable examples at PC and narrow widths', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  const flow = page.getByRole('list', { name: '음악 펫을 만나는 과정' })
  await flow.scrollIntoViewIfNeeded()
  await expect(flow.locator(':scope > li')).toHaveCount(3)
  await expect(flow.getByText('분석 예시', { exact: true })).toBeVisible()
  await expect(flow.getByText('결과 예시', { exact: true })).toBeVisible()
  const steps = await flow.locator(':scope > li').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x))
  expect(steps[0]).toBeLessThan(steps[1])
  expect(steps[1]).toBeLessThan(steps[2])
  await page.screenshot({ path: info.outputPath('how-it-works-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const narrowSteps = await flow.locator(':scope > li').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x))
  expect(narrowSteps[0]).toBe(narrowSteps[1])
  expect(narrowSteps[1]).toBe(narrowSteps[2])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('result entry reveals the real values, and reduced motion keeps everything visible without animation', async ({ page }, info) => {
  await signedInPreview(page)
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: {
    id: 'motion-result', analyzedAt: '2026-10-29T00:00:00Z',
    genres: { vector: { pop: .5, indie: .3, rock: .2 }, unmappedTags: [], tagCount: 10, trackCount: 20 },
    character: { slug: 'mochi', name: '멜로', description: '아늑한 몽상가', imageUrl: '/characters/mochi.png', score: .92 },
    profile: { mainstream: 60, obscurity: 40, comment: '편안한 멜로디를 즐겨 들어요.' },
    recommendations: [], recommendationsAvailable: true, warnings: [],
  } }))
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '멜로', exact: true })).toBeVisible()
  await page.locator('.result-page').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))))
  await expect(page.getByText('92% 매칭', { exact: true })).toBeVisible()
  await expect(page.getByText('마이너함 40%', { exact: true })).toBeVisible()
  await page.locator('.profile-meter').scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('.profile-meter .genre-fill').evaluate(element => element.getBoundingClientRect().width / element.parentElement!.getBoundingClientRect().width)).toBeCloseTo(.4)
  await page.screenshot({ path: info.outputPath('result-entry-completed.png') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.getByRole('heading', { name: '멜로', exact: true })).toBeVisible()
  for (const selector of ['.result-heading', '.analysis-pet', '.profile-meter .genre-fill', '.genre-breakdown .genre-fill']) {
    expect(await page.locator(selector).first().evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  }
  await expect(page.getByText('92% 매칭', { exact: true })).toBeVisible()
})

test('like confirmation appears after the server succeeds and does not replay from saved state', async ({ page }) => {
  await signedInPreview(page)
  await mockPlayers(page)
  let fail = true
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/posts/1/like', async route => {
    if (fail) return route.fulfill({ status: 500, json: {} })
    await pending
    return route.fallback()
  })
  await page.goto('/community')
  const post = page.getByRole('article', { name: '초록밤의 음악 공유' })
  const like = post.getByRole('button', { name: '공감 24', exact: true })
  await like.click()
  await expect(page.getByRole('alert')).toContainText('공감을 변경하지 못했어요')
  expect(await page.evaluate(() => window.musicPetsMotionEvents)).not.toContain('reaction-confirm')
  fail = false
  await like.click()
  await expect(like).toBeDisabled()
  expect(await page.evaluate(() => window.musicPetsMotionEvents)).not.toContain('reaction-confirm')
  release()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => window.musicPetsMotionEvents)).toContain('reaction-confirm')
  await page.reload()
  await expect(post.getByRole('button', { name: '공감 25', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await post.locator('.post-reaction-icon').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
})

test('a submitted comment is revealed and highlighted only after successful saving', async ({ page }, info) => {
  await signedInPreview(page)
  await mockPlayers(page)
  await page.setViewportSize({ width: 1440, height: 800 })
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 1), postId: '1', parentId: null, author: '음악 친구', avatarSlug: null,
    body: `함께 듣는 음악 이야기 ${index + 1}`, createdAt: '2026-10-29T00:00:00Z', own: false, deleted: false,
  }))
  const saved = { ...rows[0], id: '100', own: true, body: '방금 내가 등록한 댓글' }
  let fail = true
  let completed = false
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route(/\/api\/posts\/1\/comments(?:\?.*)?$/, async route => {
    if (route.request().method() === 'POST') {
      if (fail) return route.fulfill({ status: 500, json: {} })
      await pending
      completed = true
      return route.fulfill({ status: 201, json: saved })
    }
    return route.fulfill({ json: { items: completed ? [saved, ...rows] : rows, page: 0, hasMore: false } })
  })
  await page.goto('/community')
  const post = page.getByRole('article', { name: '초록밤의 음악 공유' })
  await post.getByRole('button', { name: /^댓글 \d+개$/ }).click()
  const input = post.getByRole('textbox', { name: '댓글 입력', exact: true })
  await input.fill(saved.body)
  await post.getByRole('button', { name: '댓글 등록', exact: true }).click()
  await expect(post.getByRole('alert')).toContainText('댓글을 저장하지 못했어요')
  await expect(input).toHaveValue(saved.body)
  expect(await page.evaluate(() => window.musicPetsMotionEvents)).not.toContain('comment-confirm')
  fail = false
  await post.getByRole('button', { name: '댓글 등록', exact: true }).click()
  await expect(input).toBeDisabled()
  release()
  await expect(post.getByText(saved.body, { exact: true })).toBeInViewport()
  await expect.poll(() => page.evaluate(() => window.musicPetsMotionEvents)).toContain('comment-confirm')
  await expect(input).toHaveValue('')
  await expect.poll(() => post.locator('.comment-list > .post-comment').first().evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 16 && bounds.bottom <= innerHeight - 16
  })).toBe(true)
  await page.screenshot({ path: info.outputPath('comment-confirmed.png') })
})
