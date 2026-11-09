import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

test('Spotify rate limit waits before manual retry without automatic requests', async ({ page }) => {
  await page.clock.install()
  let calls = 0
  await page.route('**/api/analysis', async (route) => {
    calls++
    await route.fulfill(calls === 1 ? { status: 429, json: {
      error: 'SPOTIFY_RATE_LIMITED', message: 'Spotify 요청이 잠시 제한됐어요.', retryAfterSeconds: 120,
    } } : { json: result })
  })
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: 'Spotify 요청이 잠시 제한됐어요' })).toBeVisible()
  const retry = page.getByRole('button', { name: '다시 분석하기' })
  await expect(retry).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Spotify 다시 연결' })).toHaveCount(0)
  await page.clock.fastForward(121_000)
  await expect(retry).toBeEnabled()
  expect(calls).toBe(1)
  await retry.click()
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  expect(calls).toBe(2)
})

for (const action of ['initial-recommendations', 'recommendations', 'save'] as const) {
  test(`Spotify quota during ${action} keeps results and delays new requests`, async ({ page }) => {
    await page.clock.install()
    const limit = { error: 'SPOTIFY_QUOTA_EXCEEDED', message: 'Spotify 사용량 한도에 도달했어요.',
      retryAfterSeconds: 120, retryAt: new Date(Date.now() + 120_000).toISOString() }
    await page.route('**/api/analysis', route => route.fulfill({ json: action === 'save' ? result : {
      ...result, recommendations: [], recommendationsAvailable: false,
      recommendationLimit: action === 'initial-recommendations' ? limit : null,
    } }))
    let calls = 0
    const endpoint = action === 'save' ? '**/api/analysis/recommendations/save' : '**/api/analysis/analysis-1/recommendations'
    await page.route(endpoint, async route => {
      calls++
      await route.fulfill({ status: 429, json: limit })
    })
    await page.goto('/analyze')
    await expect(page).toHaveURL(/\/result$/)
    if (action !== 'initial-recommendations') {
      await page.getByRole('button', { name: action === 'save' ? 'Spotify에 저장' : '추천곡 다시 시도' }).click()
    }
    await expect(page.getByRole('heading', { name: 'Spotify 사용량 한도에 도달했어요' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '다시 분석하기' })).toBeDisabled()
    await expect(page.getByRole('button', { name: action === 'save' ? 'Spotify에 저장' : '추천곡 다시 시도' })).toBeDisabled()
    await page.clock.fastForward(121_000)
    await expect(page.getByRole('button', { name: '다시 분석하기' })).toBeEnabled()
    expect(calls).toBe(action === 'initial-recommendations' ? 0 : 1)
  })
}

const result = {
  id: 'analysis-1', analyzedAt: '2026-09-08T00:00:00Z',
  genres: {
    vector: { pop: 0, rock: 0, indie: 0, electronic: 1, 'hip-hop': 0, 'r-and-b': 0, jazz: 0, classical: 0, folk: 0, metal: 0, latin: 0, 'k-pop': 0, 'j-pop': 0 },
    unmappedTags: [], tagCount: 3, trackCount: 1,
  },
  character: { slug: 'pip', name: '핍', description: '신난 장난꾸러기', imageUrl: '/characters/pip.png', score: 0.9 },
  profile: { mainstream: 60, obscurity: 40, comment: '전자음악을 즐겨 듣네요.' },
  recommendations: [{ name: '추천 노래', artist: '추천 가수', uri: 'spotify:track:abc', imageUrl: '' }],
  recommendationsAvailable: true, warnings: [],
}

const core = { ...result, profile: null, profilePending: true, recommendations: [],
  recommendationsPending: true, recommendationsAvailable: false }

test('analysis loading uses honest status and immediately shows completed core with detail requests', async ({ page }, info) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let calls = 0
  await page.route('**/api/analysis', async route => { calls++; await pending; await route.fulfill({ json: core }) })
  const details: string[] = []
  for (const path of ['profile', 'recommendations/initial']) await page.route('**/api/analysis/analysis-1/' + path, route => {
    details.push(path); return route.fulfill({ json: { ...result, profilePending: false, recommendationsPending: false } })
  })
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하고 있어요' })).toBeVisible()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('link', { name: '홈으로', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('analysis-wait-' + width + '.png') })
  }
  release()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  await expect.poll(() => details.length).toBe(2)
  expect(calls).toBe(1)
})

test('a slow analysis is shown immediately when ready and failures have no artificial wait', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-02T00:00:01Z'))
  let release!: () => void
  const coreReady = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/analysis', async route => {
    await coreReady
    await route.fulfill({ json: result })
  })
  await page.goto('/analyze')
  await expect(page.getByText('음악 취향을 분석하고 있어요', { exact: true })).toBeVisible()
  await page.clock.runFor(3000)
  release()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  await page.route('**/api/analysis', route => route.fulfill({ status: 502, json: {} }))
  const failedResponse = page.waitForResponse('**/api/analysis')
  await page.getByRole('button', { name: '다시 분석하기' }).click()
  await failedResponse
  // React의 Suspense 전환 알림이 처리될 시간을 주되 2.5초까지 진행하지 않는다.
  await page.clock.runFor(500)
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하지 못했어요' })).toBeVisible()
})

test('pet and genres appear while details wait; recommendations can arrive before the AI comment', async ({ page }, info) => {
  let analyses = 0
  await page.route('**/api/analysis', route => {
    analyses++
    expect(route.request().headers()['x-analysis-mode']).toBe('progressive')
    return route.fulfill({ json: core })
  })
  let releaseSongs!: () => void
  const songs = new Promise<void>(resolve => { releaseSongs = resolve })
  await page.route('**/api/analysis/analysis-1/recommendations/initial', async route => {
    await songs
    await route.fulfill({ json: { ...result, profile: null, profilePending: true, recommendationsPending: false } })
  })
  let releaseComment!: () => void
  const comment = new Promise<void>(resolve => { releaseComment = resolve })
  await page.route('**/api/analysis/analysis-1/profile', async route => {
    await comment
    await route.fulfill({ json: { ...result, profilePending: false, recommendationsPending: false } })
  })
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  await expect(page.locator('.genre-track').first()).toBeVisible()
  await expect(page.getByText('취향 설명을 쓰고 있어요.')).toBeVisible()
  await expect(page.getByText('추천곡을 찾고 있어요.')).toBeVisible()
  await expect(page.locator('.profile-card .seed-skeleton--tone_magic')).toHaveCount(3)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.profile-card').scrollIntoViewIfNeeded()
    await expect(page.locator('.profile-card')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`taste-loading-${width}.png`), animations: 'disabled' })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.seed-skeleton').first().evaluate(element =>
    getComputedStyle(element, '::after').animationName)).toBe('none')
  releaseSongs()
  await expect(page.getByText('추천 노래', { exact: true })).toBeVisible()
  await expect(page.getByText('취향 설명을 쓰고 있어요.')).toBeVisible()
  releaseComment()
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  await expect(page.locator('.profile-card .seed-skeleton')).toHaveCount(0)
  await expect(page.getByText('추천 노래', { exact: true })).toBeVisible()
  expect(analyses).toBe(1)
})

test('a saved pet survives a comment outage and retry without rerunning analysis', async ({ page }) => {
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: core }) })
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: {
    ...result, profile: null, profilePending: true, recommendationsPending: false,
  } }))
  let comments = 0
  await page.route('**/api/analysis/analysis-1/profile', route => route.fulfill(++comments === 1
    ? { status: 502, json: {} } : { json: result }))
  await page.goto('/result')
  await expect(page.getByText('취향 설명을 불러오지 못했어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  await expect(page.getByText('추천 노래', { exact: true })).toBeVisible()
  await page.locator('.profile-card').getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  expect(comments).toBe(2)
  expect(analyses).toBe(0)
})

for (const action of ['recommendations', 'save'] as const) {
  test(`pending ${action} blocks duplicate requests and restores controls after completion`, async ({ page }) => {
    await page.route('**/api/analysis', route => route.fulfill({ json: action === 'save' ? result : {
      ...result, recommendations: [], recommendationsAvailable: false,
    } }))
    let calls = 0
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    await page.route(action === 'save' ? '**/api/analysis/recommendations/save' : '**/api/analysis/analysis-1/recommendations', async route => {
      calls++
      await pending
      await route.fulfill({ json: action === 'save' ? { playlistUrl: 'https://open.spotify.com/playlist/test' } : result })
    })
    await page.goto('/analyze')
    await expect(page).toHaveURL(/\/result$/)
    const button = page.getByRole('button', { name: action === 'save' ? /(Spotify에 저장|저장 중…)$/ : /(추천곡 다시 시도|추천곡을 찾는 중…)$/ })
    await button.click()
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('data-loading')
    await button.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
    expect(calls).toBe(1)
    release()
    if (action === 'save') await expect(page.getByRole('link', { name: /플레이리스트 열기/ })).toBeVisible()
    else await expect(page.getByText('추천 노래', { exact: true })).toBeVisible()
  })
}

test('reconnecting from a saved result returns to that result without starting another analysis', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
  let analyses = 0
  await page.route('**/api/analysis', route => { analyses++; return route.fulfill({ json: result }) })
  await page.route('**/api/analysis/recommendations/save', route => route.fulfill({ status: 403, json: { error: 'SPOTIFY_REAUTH_REQUIRED' } }))
  await page.goto('/result')
  await page.getByRole('button', { name: 'Spotify에 저장' }).click()
  const reconnect = page.getByRole('link', { name: 'Spotify 다시 연결' })
  await expect(reconnect).toHaveAttribute('href', '/login?next=%2Fresult')
  await reconnect.click()
  // The OAuth service is mocked; exercise the login handler before returning to its callback.
  await page.route('**/oauth2/authorization/spotify', route => route.fulfill({ contentType: 'text/html', body: 'Spotify OAuth test' }))
  await page.getByRole('button', { name: /Spotify로 계속하기/ }).click()
  await mockAuth(page, 'reconnected-access')
  await page.goto('/oauth/callback')
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('내 취향')
  await expect(page.locator('.result-toolbar time')).toHaveAttribute('datetime', result.analyzedAt)
  expect(analyses).toBe(0)
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'test', displayName: 'Test', email: '' } }))
  await mockAuth(page, 'test-access')
})

test('slow analysis explains the wait and retry resets the notice', async ({ page }) => {
  await page.clock.install()
  let releaseFailure!: () => void
  let releaseSuccess!: () => void
  const failure = new Promise<void>(resolve => { releaseFailure = resolve })
  const success = new Promise<void>(resolve => { releaseSuccess = resolve })
  let calls = 0
  await page.route('**/api/analysis', async route => {
    calls++
    if (calls === 1) {
      await failure
      await route.fulfill({ status: 502, json: { message: '잠시 후 다시 시도해주세요.' } })
    } else {
      await success
      await route.fulfill({ json: result })
    }
  })
  const initial = page.getByText('청취 기록에서 취향이 닮은 펫과 추천 아티스트를 찾고 있어요.', { exact: true })
  const delayed = page.getByText('평소보다 시간이 걸리고 있어요. 잠시만 기다려주세요.', { exact: true })

  await page.goto('/analyze')
  await expect(initial).toBeVisible()
  await expect(delayed).toHaveCount(0)
  await page.clock.fastForward(10_000)
  await expect(delayed).toBeVisible()
  expect(calls).toBe(1)

  releaseFailure()
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하지 못했어요' })).toBeVisible()
  await page.getByRole('button', { name: '다시 분석하기' }).click()
  await expect(initial).toBeVisible()
  await expect(delayed).toHaveCount(0)
  releaseSuccess()
  await expect(page).toHaveURL(/\/result$/)
  await page.clock.fastForward(10_000)
  await expect(delayed).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  expect(calls).toBe(2)
})

test('core failure can retry and every result card reuses one analysis', async ({ page }, testInfo) => {
  let calls = 0
  await page.route('**/api/analysis', async (route) => {
    calls++
    await route.fulfill(calls === 1
      ? { status: 502, json: { message: '잠시 후 다시 시도해주세요.' } }
      : { json: result })
  })
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: '음악 취향을 분석하지 못했어요' })).toBeVisible()
  await page.getByRole('button', { name: '다시 분석하기' }).click()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  await expect(page.getByText('추천 노래')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true })
  await expect(page.getByRole('link', { name: '내 프로필', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'MusicPets', exact: true }).click()
  await expect(page.locator('header').getByRole('link', { name: '내 음악 취향 분석하기', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '프로필' }).click()
  await page.getByRole('menuitem', { name: '내 프로필' }).click()
  await expect(page).toHaveURL(/\/mypage$/)
  await expect(page.getByText(result.profile.comment)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '내 펫', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '다시 분석하기' })).toHaveCount(0)
  await page.getByRole('banner').getByRole('link', { name: 'MusicPets', exact: true }).click()
  await expect(page.locator('.cta-section').getByRole('link', { name: '내 취향 보기' })).toHaveAttribute('href', '/result')
  await page.locator('.music-hero').getByRole('link', { name: '내 취향 보기' }).click()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByText(result.profile.comment)).toBeVisible()
  expect(calls).toBe(2)
  await page.getByRole('button', { name: '다시 분석하기' }).click()
  await expect(page).toHaveURL(/\/result$/)
  expect(calls).toBe(3)
})

test('recommendation retry and playlist save do not rerun analysis', async ({ page }) => {
  let analysisCalls = 0
  await page.route('**/api/analysis', async (route) => {
    analysisCalls++
    await route.fulfill({ json: { ...result, recommendations: [], recommendationsAvailable: false } })
  })
  await page.route('**/api/analysis/analysis-1/recommendations', (route) => route.fulfill({ json: result }))
  let saves = 0
  await page.route('**/api/analysis/recommendations/save', async (route) => {
    expect(route.request().postDataJSON().uris).toEqual(['spotify:track:abc'])
    saves++
    await route.fulfill(saves === 1 ? { status: 502, json: { message: '저장 실패' } }
      : { json: { playlistUrl: 'https://open.spotify.com/playlist/test' } })
  })
  await page.goto('/analyze')
  await expect(page).toHaveURL(/\/result$/)
  await page.getByRole('button', { name: '추천곡 다시 시도' }).click()
  await expect(page.getByText('추천 노래')).toBeVisible()
  await page.getByRole('button', { name: 'Spotify에 저장' }).click()
  await expect(page.getByRole('alert')).toContainText('저장')
  await page.getByRole('button', { name: 'Spotify에 저장' }).click()
  await expect(page.getByRole('link', { name: /플레이리스트 열기/ })).toHaveAttribute('href', 'https://open.spotify.com/playlist/test')
  expect(analysisCalls).toBe(1)
})

test('direct saved result access does not rerun analysis or unlock a character without listening data', async ({ page }) => {
  let analysisCalls = 0
  await page.route('**/api/analysis', route => { analysisCalls++; return route.fulfill({ json: result }) })
  await page.route('**/api/analysis/latest', (route) => route.fulfill({ json: {
    ...result, character: null, genres: { ...result.genres, vector: {}, trackCount: 0, tagCount: 0 },
    profile: { mainstream: null, obscurity: null, comment: '데이터가 부족해요.' }, recommendations: [],
  } }))
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '아직 음악 펫을 찾지 못했어요' })).toBeVisible()
  await expect(page.getByText('마이너함 100%')).toHaveCount(0)
  expect(analysisCalls).toBe(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('unlocked-characters') ?? '{"state":{"unlocked":[]}}').state.unlocked)).toEqual([])
})

test('expired Spotify grant offers reconnect and waits for another analysis click after login', async ({ page }) => {
  let calls = 0
  let jwtRefreshCalls = 0
  await page.route('**/api/auth/refresh', async (route) => {
    jwtRefreshCalls++
    await route.fulfill({ json: { access: 'test-access' } })
  })
  await page.route('**/api/analysis', async (route) => {
    calls++
    await route.fulfill(calls === 1
      ? { status: 403, json: { error: 'SPOTIFY_REAUTH_REQUIRED', message: 'Spotify에 다시 연결해주세요.' } }
      : { json: result })
  })
  await page.goto('/analyze')
  await expect(page.getByRole('heading', { name: 'Spotify에 다시 연결해주세요' })).toBeVisible()
  await expect(page.getByRole('button', { name: '다시 분석하기' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Spotify 다시 연결' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2F$/)
  expect(jwtRefreshCalls).toBe(1) // Only the initial session restoration, never on Spotify's 403.
  // 재연결 완료만으로 분석을 다시 실행하지 않는다.
  await page.route('**/oauth2/authorization/spotify', route => route.fulfill({ contentType: 'text/html', body: 'Spotify OAuth test' }))
  await page.getByRole('button', { name: /Spotify로 계속하기/ }).click()
  await expect(page).toHaveURL(/\/oauth2\/authorization\/spotify$/)
  await page.goto('/oauth/callback')
  await expect(page).toHaveURL('http://127.0.0.1:5178/')
  await expect(page.getByRole('button', { name: '프로필', exact: true })).toBeVisible()
  expect(calls).toBe(1)
  await page.locator('.music-hero-actions').getByRole('link', { name: '내 음악 취향 분석하기', exact: true }).click()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
  expect(calls).toBe(2)
  expect(jwtRefreshCalls).toBe(2)
})

for (const action of ['recommendations', 'save'] as const) {
  test(`expired Spotify grant during ${action} preserves results and offers reconnect`, async ({ page }) => {
    await page.route('**/api/analysis', (route) => route.fulfill({ json: action === 'recommendations'
      ? { ...result, recommendations: [], recommendationsAvailable: false } : result }))
    const endpoint = action === 'recommendations'
      ? '**/api/analysis/analysis-1/recommendations' : '**/api/analysis/recommendations/save'
    let calls = 0
    await page.route(endpoint, async (route) => {
      calls++
      await route.fulfill({ status: 403, json: { error: 'SPOTIFY_REAUTH_REQUIRED', message: 'Spotify에 다시 연결해주세요.' } })
    })
    await page.goto('/analyze')
    await expect(page).toHaveURL(/\/result$/)
    const buttonName = action === 'recommendations' ? '추천곡 다시 시도' : 'Spotify에 저장'
    await page.getByRole('button', { name: buttonName }).click()
    await expect(page.getByRole('link', { name: 'Spotify 다시 연결' })).toBeVisible()
    await expect(page.getByRole('button', { name: buttonName })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '핍', exact: true })).toBeVisible()
    expect(calls).toBe(1)
  })
}
