import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'

/** Render only the shareable summary, without account details or private result URLs. */
export async function createResultShareImage(data: AnalysisResult): Promise<File> {
  const character = data.character
  if (!character) throw new Error('A music pet is required to share the result.')

  const styles = getComputedStyle(document.documentElement)
  const color = (role: string) => styles.getPropertyValue(`--seed-color-${role}`).trim()
  const family = styles.getPropertyValue('--seed-font-family').trim()
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = character.imageUrl
  await Promise.all([
    image.decode(),
    Promise.allSettled([
      document.fonts.load(`700 80px ${family}`),
      document.fonts.load('400 58px "DNFBitBitv2"'),
    ]),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create the sharing image.')

  const box = (x: number, y: number, width: number, height: number, radius: number, fill: string) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    ctx.fill()
  }
  const text = (value: string, x: number, y: number, size: number, fill: string, weight = 400) => {
    ctx.font = `${weight} ${size}px ${family}`
    ctx.fillStyle = fill
    ctx.fillText(value, x, y, 856)
  }
  const ink = color('fg-neutral')
  const muted = color('fg-neutral-muted')
  const brand = color('fg-brand')
  const brandContrast = color('fg-brand-contrast')
  const weak = color('bg-brand-weak')

  box(0, 0, 1080, 1350, 0, weak)
  box(48, 48, 984, 1254, 44, color('bg-layer-default'))
  ctx.textBaseline = 'middle'
  ctx.font = '400 58px "DNFBitBitv2"'
  ctx.fillStyle = ink
  ctx.fillText('Music', 104, 116)
  const logoWidth = ctx.measureText('Music').width
  ctx.fillStyle = brand
  ctx.fillText('Pets', 104 + logoWidth, 116)
  ctx.textAlign = 'right'
  text(`${analysisPeriodLabel(data)} 음악 취향`, 976, 116, 27, muted)

  ctx.textAlign = 'center'
  text('내 음악 취향을 닮은 펫', 540, 218, 30, muted)
  text(character.name, 540, 294, 80, ink, 700)
  text(`${data.genres.trackCount}곡에서 찾은 나의 음악 취향`, 540, 358, 28, muted)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(324, 410, 432, 432, 36)
  ctx.clip()
  const scale = Math.min(432 / image.naturalWidth, 432 / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  ctx.drawImage(image, 540 - width / 2, 626 - height / 2, width, height)
  ctx.restore()
  box(420, 866, 240, 62, 31, weak)
  text(`${Math.round(character.score * 100)}% 매칭`, 540, 897, 30, brandContrast, 700)

  ctx.textAlign = 'left'
  text('나의 음악 취향', 112, 972, 27, muted, 700)
  // Use the saved interpretation, including old results; never invent a new story on share.
  const comment = (!data.profilePending && data.profile?.comment.trim())
    || '분석한 장르 비중을 비교해 만난 음악 펫이에요.'
  ctx.font = `400 32px ${family}`
  const lines: string[] = []
  let line = ''
  for (const char of comment.replace(/\s+/g, ' ').trim()) {
    const candidate = line + char
    if (line && ctx.measureText(candidate).width > 856) {
      const space = candidate.lastIndexOf(' ')
      // Keep Korean words together; split only words wider than the whole line.
      lines.push((space > 0 ? candidate.slice(0, space) : line).trim())
      line = space > 0 ? candidate.slice(space + 1) : char
    } else line = candidate
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length > 5) {
    let last = lines[4]
    while (ctx.measureText(last + '…').width > 856) last = Array.from(last).slice(0, -1).join('')
    lines[4] = last.trimEnd() + '…'
  }
  lines.slice(0, 5).forEach((value, index) => text(value, 112, 1024 + index * 42, 32, ink))
  ctx.textAlign = 'center'
  text('음악으로 만나는 나의 취향 · MusicPets', 540, 1252, 25, muted)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error('Unable to export the sharing image.')), 'image/png',
  ))
  const slug = character.slug.replace(/[^a-z0-9-]/gi, '') || 'result'
  return new File([blob], `musicpets-${slug}.png`, { type: 'image/png' })
}
