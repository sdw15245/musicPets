import { expect, test } from './test'
import { mockPlayers, signedInPreview } from './community-fixture'
import { samplePosts } from './community-data'

test.beforeEach(async ({ page }) => { await signedInPreview(page); await mockPlayers(page) })

test('automatic search shows empty results and manual retry failures preserve the draft', async ({ page }) => {
  let calls = 0
  await page.route('**/api/tracks/search?*', route => {
    calls++
    return route.fulfill(calls === 1 ? { json: [] } : { status: 502, json: { message: 'failed' } })
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  const input = page.getByRole('textbox', { name: '곡 검색' })
  await input.fill('없는 곡')
  await expect(page.getByText('검색 결과가 없어요. 다른 제목이나 아티스트로 찾아보세요.')).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('보존할 초안')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('검색하지 못했어요')
  await expect(page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })).toHaveValue('보존할 초안')
})

test('failed publish keeps composer, successful retry waits for API, failed deletion keeps the post', async ({ page }, info) => {
  let writes = 0
  await page.route(/\/api\/posts$/, async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    writes++
    expect(route.request().postDataJSON()).toEqual({ trackUri: 'spotify:track:5VBjyOQzqlPNgdRPMM6prF', caption: 'API 저장 테스트', tags: [] })
    if (writes === 1) return route.fulfill({ status: 500, json: { message: 'failed' } })
    return route.fallback()
  })
  await page.goto('/community')
  await page.getByRole('button', { name: '오늘의 한 곡 올리기' }).click()
  await page.getByRole('textbox', { name: '곡 검색' }).fill('seasons')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByRole('button', { name: 'seasons — wave to earth' }).click()
  await page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' }).fill('API 저장 테스트')
  await page.getByRole('button', { name: '공유하기', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('저장하지 못했어요')
  await expect(page.getByRole('textbox', { name: '이 곡을 나누고 싶은 이유' })).toHaveValue('API 저장 테스트')
  await page.getByRole('button', { name: '공유하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  const post = page.getByRole('article').filter({ hasText: 'API 저장 테스트' })
  await expect(post).toBeVisible()
  let failDelete = true
  let releaseDelete!: () => void
  const pendingDelete = new Promise<void>(resolve => { releaseDelete = resolve })
  await page.route('**/api/posts/100', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    if (failDelete) return route.fulfill({ status: 500, json: {} })
    await pendingDelete
    return route.fallback()
  })
  await post.getByRole('button', { name: '내 글 삭제' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제 확인' }).click()
  await expect(page.getByRole('alert')).toContainText('삭제하지 못했어요')
  const dialog = page.getByRole('alertdialog')
  await page.screenshot({ path: info.outputPath('delete-error-desktop.png') })
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(post).toBeVisible()
  await expect(post.getByRole('button', { name: '내 글 삭제' })).toBeFocused()
  failDelete = false
  await post.getByRole('button', { name: '내 글 삭제' }).click()
  await dialog.getByRole('button', { name: '삭제 확인' }).click()
  await expect(dialog.getByRole('button', { name: /삭제 확인$/ })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  releaseDelete()
  await expect(dialog).toHaveCount(0)
  await expect(post).toHaveCount(0)
  await expect(page.getByText('공유한 글을 삭제했어요.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('community-preview') ?? '{"state":{"sessions":{}}}').state.sessions)).toEqual({})
})

test('feed distinguishes empty, failed and paginated responses without sample fallback', async ({ page }) => {
  let mode = 'error'
  await page.route(/\/api\/posts\?/, route => {
    if (mode === 'error') return route.fulfill({ status: 500, json: {} })
    const pageNo = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { items: mode === 'empty' ? [] : [{ ...samplePosts[0], id: String(pageNo + 1), caption: `페이지 ${pageNo + 1}` }], page: pageNo, hasMore: mode === 'pages' && pageNo === 0 } })
  })
  await page.goto('/community')
  await expect(page.getByRole('alert')).toContainText('글 목록을 불러오지 못했어요')
  await expect(page.getByRole('article')).toHaveCount(0)
  mode = 'empty'
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByText('첫 번째 음악을 들려주세요')).toBeVisible()
  mode = 'pages'
  await page.reload()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('button', { name: '음악 더 보기' }).click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '음악 더 보기' })).toHaveCount(0)
})
