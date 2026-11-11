import { expect, test } from './test'
import { signedInPreview } from './community-fixture'

const result = {
  id: 'stored-result', analyzedAt: '2026-10-08T00:00:00Z',
  genres: { vector: { pop: 1 }, unmappedTags: [], tagCount: 1, trackCount: 1 },
  character: { slug: 'pip', name: '루바', description: '음악 친구', imageUrl: '/characters/pip.png', score: .9 },
  profile: { mainstream: 60, obscurity: 40, comment: '서버에 저장된 취향 설명' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => signedInPreview(page, null))

test('saved result survives refresh and home navigation without starting analysis', async ({ page }, testInfo) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.abort() })
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  await page.goto('/result')
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  await page.reload()
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  await page.getByRole('link', { name: 'MusicPets', exact: true }).click()
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 취향 보기' })).toBeVisible()
  const summary = page.getByRole('region', { name: '나의 음악 취향 요약' })
  await expect(summary.getByRole('img', { name: '루바', exact: true })).toBeVisible()
  await expect(summary).toContainText('90% 매칭')
  await expect(summary).toContainText(result.profile.comment)
  await expect(summary.getByRole('listitem')).toHaveCount(0)
  await expect(summary.getByRole('radiogroup')).toHaveCount(0)
  await expect(summary.getByRole('button', { name: '다음 펫 보기' })).toHaveCount(0)
  await page.clock.install()
  await page.clock.runFor(15000)
  await expect(summary.getByRole('img', { name: '루바', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: testInfo.outputPath('home-saved-result-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('home-saved-result-mobile.png'), fullPage: true })
  expect(analyses).toBe(0)
})

test('home never substitutes an example pet or genres for an incomplete saved analysis', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.abort() })
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: {
    ...result, character: null, genres: { ...result.genres, vector: {} },
  } }))
  await page.goto('/')
  const summary = page.getByRole('region', { name: '나의 음악 취향 요약' })
  await expect(summary.getByRole('heading', { name: '아직 펫을 찾지 못했어요' })).toBeVisible()
  await expect(summary).toContainText('청취 기록이나 장르 정보가 부족해요.')
  await expect(summary.getByRole('img')).toHaveCount(0)
  await expect(summary.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('radiogroup', { name: '예시 펫 선택' })).toHaveCount(0)
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 취향 보기' })).toHaveAttribute('href', '/result')
  expect(analyses).toBe(0)
})

test('logging out replaces the personal hero summary with clearly labeled examples', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 204 }))
  await page.goto('/')
  await expect(page.getByRole('region', { name: '나의 음악 취향 요약' })).toContainText(result.profile.comment)
  await page.getByRole('button', { name: '프로필', exact: true }).click()
  await page.getByRole('menuitem', { name: '로그아웃', exact: true }).click()
  const examples = page.getByRole('region', { name: '음악 펫 결과 예시' })
  await expect(examples).toContainText('결과 예시')
  await expect(page.getByText(result.profile.comment, { exact: true })).toHaveCount(0)
  await expect(page.locator('.music-hero').getByRole('link', { name: '내 음악 취향 분석하기' })).toBeVisible()
  await examples.getByRole('button', { name: '다음 펫 보기' }).click()
  await examples.getByRole('button', { name: '다음 펫 보기' }).click()
  await expect(examples.getByRole('heading', { name: '코다', exact: true })).toBeVisible()
})

test('failed result retrieval offers read retry without silently starting a new analysis', async ({ page }) => {
  let analyses = 0
  let reads = 0
  await page.route('**/api/analysis', route => { analyses++; return route.abort() })
  await page.route('**/api/analysis/latest', route => route.fulfill(++reads === 1
    ? { status: 500, json: { message: 'failed' } } : { json: result }))
  await page.goto('/result')
  await expect(page.getByRole('alert')).toContainText('저장된 결과를 불러오지 못했어요')
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  expect(analyses).toBe(0)
})

test('server analysis pet supplies the profile photo despite old avatar preferences', async ({ page }, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('profile-preview', JSON.stringify({ state: { profiles: {
      'session:preview-user': { name: '오래된 이름', avatar: 'mochi', analyzedPet: 'mochi' },
    } }, version: 0 }))
    localStorage.setItem('unlocked-characters', JSON.stringify({ state: { byUser: { '1': ['mochi'] } }, version: 0 }))
  })
  await page.route('**/api/me', route => route.fulfill({ json: {
    id: 1, spotifyId: 'spotify', email: '', displayName: 'Spotify 이름', nickname: '저장한 이름',
    avatar: 'none', analyzedPet: 'pip', unlockedCharacters: ['pip'],
  } }))
  await page.goto('/mypage')
  await page.getByRole('button', { name: '이름 수정', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('저장한 이름')
  await expect(page.getByRole('img', { name: '분석 펫 프로필 사진' })).toHaveAttribute('src', '/characters/pip.png')
  await expect(page.locator('.profile-editor').getByRole('radio')).toHaveCount(0)
  await page.locator('.mypage-profile-card').screenshot({ path: info.outputPath('automatic-pet-profile.png') })
  await page.getByRole('link', { name: 'MusicPets', exact: true }).click()
  await expect(page.locator('.character-card').filter({ hasText: '발견 완료' }).getByRole('img')).toHaveAttribute('alt', '루바')
})

test('profile save failure preserves the draft and never reports success', async ({ page }) => {
  await page.route('**/api/me', async route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 500, json: { message: 'failed' } })
    return route.fallback()
  })
  await page.goto('/mypage')
  await page.getByRole('button', { name: '이름 수정', exact: true }).click()
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('저장할 이름')
  await page.getByRole('button', { name: '프로필 저장' }).click()
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요')
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('저장할 이름')
  await page.reload()
  await page.getByRole('button', { name: '이름 수정', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('음악 친구')
})
