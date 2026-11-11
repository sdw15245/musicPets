import { readFile } from 'node:fs/promises'
import { expect, test } from './test'
import { mockAuth } from './auth-fixture'

const result = {
  id: 'share-result', analyzedAt: '2026-10-29T00:00:00Z',
  genres: { vector: { pop: .5, indie: .3, electronic: .2 }, unmappedTags: [], tagCount: 10, trackCount: 20 },
  character: { slug: 'mochi', name: '멜로', description: '아늑한 몽상가', imageUrl: '/characters/mochi.png', score: .92 },
  profile: { mainstream: 60, obscurity: 40, comment: '편안한 멜로디를 즐겨 들어요.' },
  recommendations: [], recommendationsAvailable: true, warnings: [],
}

test.beforeEach(async ({ page }) => {
  await mockAuth(page, 'test-access')
  await page.route('**/api/me', route => route.fulfill({ json: { id: 1, spotifyId: 'test', displayName: 'Test', email: '' } }))
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: result }))
})

test('sharing code loads only on demand and the dialog can close while it loads', async ({ page }) => {
  const requests: string[] = []
  let release!: () => void
  const loading = new Promise<void>(resolve => { release = resolve })
  await page.route('**/*resultShareImage*', async route => {
    requests.push(route.request().url())
    await loading
    await route.continue()
  })
  try {
    await page.goto('/result')
    const trigger = page.getByRole('button', { name: '결과 공유하기', exact: true })
    await expect(trigger).toBeVisible()
    expect(requests).toHaveLength(0)
    await trigger.click()
    await expect.poll(() => requests.length).toBeGreaterThan(0)
    await expect(page.getByRole('status', { name: '공유 이미지를 만들고 있어요.' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    release()
    await trigger.click()
    await expect(page.getByRole('img', { name: /음악 취향 공유 이미지/ })).toBeVisible()
  } finally { release() }
})

test('a sharing code download failure stays inside the closable dialog', async ({ page }) => {
  await page.route('**/*resultShareImage*', route => route.abort())
  await page.goto('/result')
  const trigger = page.getByRole('button', { name: '결과 공유하기', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드', exact: true })
  await expect(dialog.getByRole('alert')).toContainText('공유 이미지를 만들지 못했어요')
  await expect(dialog.getByRole('button', { name: '이미지 다시 만들기', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '공유창 닫기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('PC users can preview and download a full-size PNG, then close and reopen the dialog', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/result')
  const trigger = page.getByRole('button', { name: '결과 공유하기', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드', exact: true })
  const preview = dialog.getByRole('img', { name: /음악 취향 공유 이미지/ })
  await expect(preview).toBeVisible()
  await expect.poll(() => preview.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1080)
  await expect(dialog.getByRole('button', { name: '공유하기', exact: true })).toHaveCount(0)
  const firstUrl = await preview.getAttribute('src')
  await page.screenshot({ path: info.outputPath('result-share-dialog.png') })
  const downloaded = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'PNG 저장하기', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('musicpets-mochi.png')
  const filePath = info.outputPath('musicpets-mochi.png')
  await download.saveAs(filePath)
  const png = await readFile(filePath)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1080)
  expect(png.readUInt32BE(20)).toBe(1350)
  expect(png.length).toBeGreaterThan(20_000)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(preview).toBeVisible()
  await expect(preview).not.toHaveAttribute('src', firstUrl!)
  await dialog.getByRole('button', { name: '공유창 닫기', exact: true }).click()
  await expect(trigger).toBeFocused()
})

test('native sharing sends the generated file, treats cancellation quietly and retains the download on failure', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }: ShareData) => files?.[0]?.type === 'image/png' })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files, title, url }: ShareData) => {
      if (calls++ === 0) throw new DOMException('Cancelled', 'AbortError')
      if (calls === 2) throw new DOMException('Blocked', 'NotAllowedError')
      if (!files || files[0].name !== 'musicpets-mochi.png' || files[0].size < 20_000 || title !== 'MusicPets · 멜로' || url) {
        throw new Error('Unexpected share data')
      }
    } })
  })
  await page.goto('/result')
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드', exact: true })
  const share = dialog.getByRole('button', { name: '공유하기', exact: true })
  await share.click()
  await expect(share).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await share.click()
  await expect(dialog.getByRole('alert')).toContainText('공유창을 열지 못했어요')
  await expect(dialog.getByRole('button', { name: 'PNG 저장하기', exact: true })).toBeEnabled()
  await share.click()
  await expect(share).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

test('an image failure offers a working retry', async ({ page }) => {
  let fail = true
  await page.route('**/characters/mochi.png', route => fail ? route.abort() : route.continue())
  await page.goto('/result')
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '음악 취향 공유 카드', exact: true })
  await expect(dialog.getByRole('alert')).toContainText('공유 이미지를 만들지 못했어요')
  fail = false
  await dialog.getByRole('button', { name: '이미지 다시 만들기', exact: true }).click()
  await expect(dialog.getByRole('img', { name: /음악 취향 공유 이미지/ })).toBeVisible()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'PNG 저장하기', exact: true })).toBeEnabled()
})

test('a result without a matched pet does not offer a broken sharing action', async ({ page }) => {
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: { ...result, character: null } }))
  await page.goto('/result')
  await expect(page.getByRole('heading', { name: '아직 음악 펫을 찾지 못했어요', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '결과 공유하기', exact: true })).toHaveCount(0)
})

test('saved interpretation is shared and the pet story is separate from personal evidence', async ({ page }) => {
  await page.addInitScript(() => {
    const captured: string[] = []
    Object.defineProperty(window, '__sharedText', { value: captured })
    const draw = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      captured.push(value)
      if (maxWidth === undefined) draw.call(this, value, x, y)
      else draw.call(this, value, x, y, maxWidth)
    }
  })
  await page.goto('/result')
  await expect(page.getByText('아늑한 몽상가', { exact: true })).toHaveCount(0)
  await expect(page.getByText(result.profile.comment, { exact: true })).toBeVisible()
  await page.getByText('멜로의 이야기', { exact: true }).click()
  await expect(page.getByText(/멜로의 방에는 좋아하는 노래/)).toBeVisible()
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  await expect(page.getByRole('img', { name: /취향 해설이 담긴 음악 취향 공유 이미지/ })).toBeVisible()
  const drawn = await page.evaluate(() => (window as Window & { __sharedText: string[] }).__sharedText.join('\n'))
  expect(drawn).toContain(result.profile.comment)
  expect(drawn).not.toContain(result.character.description)
  expect(drawn).not.toContain('멜로의 방에는')
})

test('expanding the pet story keeps the portrait anchored on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto('/result')
    const portrait = page.locator('.analysis-pet')
    await expect(portrait).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const position = () => portrait.evaluate(element => {
      const image = element.getBoundingClientRect()
      const section = element.closest('section')!.getBoundingClientRect()
      return { x: image.x - section.x, y: image.y - section.y }
    })
    const before = await position()
    await page.getByText('멜로의 이야기', { exact: true }).click()
    await expect(page.getByText(/멜로의 방에는 좋아하는 노래/)).toBeVisible()
    const expanded = await position()
    expect(Math.abs(expanded.x - before.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(expanded.y - before.y)).toBeLessThanOrEqual(1)
    await page.getByText('멜로의 이야기', { exact: true }).click()
    expect(await position()).toEqual(before)
  }
})

test('long shared interpretations wrap at word boundaries without losing the saved words', async ({ page }, info) => {
  const comment = '인디와 힙합을 중심으로 여러 장르를 함께 듣고 있어요. 레코드 가게에서 서로 다른 음반을 골라오는 리토의 모습과 닮은 부분이에요. 같은 펫을 만났어도 어떤 음악을 곁들이는지는 서로 다를 수 있어요.'
  await page.route('**/api/analysis/latest', route => route.fulfill({ json: {
    ...result,
    genres: { ...result.genres, timeRange: 'short_term' },
    character: { ...result.character, slug: 'sulk-cat', name: '리토', imageUrl: '/characters/sulk-cat.png' },
    profile: { ...result.profile, comment },
  } }))
  await page.addInitScript(() => {
    const images: { text: string; width: number }[][] = []
    const linesByCanvas = new Map<HTMLCanvasElement, { text: string; width: number }[]>()
    Object.defineProperty(window, '__commentLines', { value: images })
    const draw = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      if (y >= 1024 && y <= 1192) {
        let lines = linesByCanvas.get(this.canvas)
        if (!lines) {
          lines = []
          linesByCanvas.set(this.canvas, lines)
          images.push(lines)
        }
        lines.push({ text: value, width: this.measureText(value).width })
      }
      if (maxWidth === undefined) draw.call(this, value, x, y)
      else draw.call(this, value, x, y, maxWidth)
    }
  })
  await page.goto('/result')
  await page.getByRole('button', { name: '결과 공유하기', exact: true }).click()
  await expect(page.getByRole('img', { name: /음악 취향 공유 이미지/ })).toBeVisible()
  // Strict Mode or refreshed data can generate more than one image; validate each canvas.
  const images = await page.evaluate(() => (window as Window & { __commentLines: { text: string; width: number }[][] }).__commentLines)
  expect(images.length).toBeGreaterThan(0)
  for (const lines of images) {
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.length).toBeLessThanOrEqual(5)
    expect(lines.every(line => line.width <= 856)).toBe(true)
    expect(lines.map(line => line.text).join(' ')).toBe(comment)
  }
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PNG 저장하기', exact: true }).click()
  await (await download).saveAs(info.outputPath('long-comment-share.png'))
})
