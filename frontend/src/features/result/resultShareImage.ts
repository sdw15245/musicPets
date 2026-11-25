import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'
import { genreLabel } from '../analysis/genreLabels'
import { resolveCharacter } from '../../shared/characters'

/** Render only the shareable summary, without account details or private result URLs. */
export async function createResultShareImage(data: AnalysisResult): Promise<File> {
  const character = data.character
  if (!character) throw new Error('A music pet is required to share the result.')

  const styles = getComputedStyle(document.documentElement)
  const color = (role: string) => styles.getPropertyValue(`--seed-color-${role}`).trim()
  const family = styles.getPropertyValue('--seed-font-family').trim()
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = resolveCharacter(character.slug)?.imageUrl ?? character.imageUrl
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
  const weak = color('bg-neutral-weak')
  // Read the pet's stage and accent from the same tokens the screens use (pet-themes.css).
  const probe = document.createElement('div')
  probe.dataset.pet = character.slug
  probe.hidden = true
  document.body.append(probe)
  const petStyles = getComputedStyle(probe)
  const pet = (name: string, fallback: string) => petStyles.getPropertyValue(`--pet-${name}`).trim() || fallback
  const stageTop = pet('stage-top', weak), stage = pet('stage', weak), stageFloor = pet('stage-floor', weak), accent = pet('accent', ink)
  probe.remove()
  const subtle = styles.getPropertyValue('--mp-ink-subtle').trim() || muted
  const stageFill = (top: number, height: number) => {
    const gradient = ctx.createLinearGradient(0, top, 0, top + height)
    gradient.addColorStop(0, stageTop)
    gradient.addColorStop(0.55, stage)
    gradient.addColorStop(1, stageFloor)
    return gradient
  }

  // The pet's own backdrop frames the card, so shared results differ at a glance.
  ctx.fillStyle = stageFill(0, 1350)
  ctx.fillRect(0, 0, 1080, 1350)
  box(48, 48, 984, 1254, 44, color('bg-layer-default'))
  ctx.textBaseline = 'middle'
  ctx.font = '400 58px "DNFBitBitv2"'
  ctx.fillStyle = ink
  ctx.fillText('Music', 104, 116)
  const logoWidth = ctx.measureText('Music').width
  ctx.fillStyle = subtle
  ctx.fillText('Pets', 104 + logoWidth, 116)
  ctx.textAlign = 'right'
  text(`${analysisPeriodLabel(data)} · ${data.genres.trackCount}곡`, 976, 116, 27, muted)

  ctx.textAlign = 'center'
  text('내 음악 취향을 닮은 펫', 540, 196, 30, muted)
  text(character.name, 540, 262, 84, ink, 700)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(330, 316, 420, 420, 40)
  ctx.clip()
  ctx.fillStyle = stageFill(316, 420)
  ctx.fillRect(330, 316, 420, 420)
  const scale = Math.min(420 / image.naturalWidth, 420 / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  ctx.drawImage(image, 540 - width / 2, 526 - height / 2, width, height)
  ctx.restore()
  box(410, 750, 260, 60, 30, ink)
  text(`${Math.round(character.score * 100)}% 매칭`, 540, 780, 30, color('fg-neutral-inverted'), 700)

  // Top genres give the card evidence worth comparing with friends.
  const genres = Object.entries(data.genres.vector).filter(([, ratio]) => ratio > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
  ctx.textAlign = 'left'
  text('많이 들은 장르', 112, 850, 26, muted, 700)
  genres.forEach(([genre, ratio], index) => {
    const y = 894 + index * 42
    ctx.textAlign = 'left'
    text(genreLabel(genre), 112, y, 28, ink)
    box(300, y - 6, 560, 12, 6, weak)
    box(300, y - 6, Math.max(12, 560 * Math.min(ratio, 1)), 12, 6, accent)
    ctx.textAlign = 'right'
    text(`${Math.round(ratio * 100)}%`, 968, y, 28, ink, 700)
  })

  ctx.textAlign = 'left'
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
  // Four lines keep clear space under the genres and above the footer.
  if (lines.length > 4) {
    let last = lines[3]
    while (ctx.measureText(last + '…').width > 856) last = Array.from(last).slice(0, -1).join('')
    lines[3] = last.trimEnd() + '…'
  }
  lines.slice(0, 4).forEach((value, index) => text(value, 112, 1056 + index * 42, 32, ink))
  ctx.textAlign = 'center'
  text('음악으로 만나는 나의 취향 · MusicPets', 540, 1252, 25, muted)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error('Unable to export the sharing image.')), 'image/png',
  ))
  const slug = character.slug.replace(/[^a-z0-9-]/gi, '') || 'result'
  return new File([blob], `musicpets-${slug}.png`, { type: 'image/png' })
}
