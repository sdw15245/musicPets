const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Community activity time: relative within a week, then a calendar date (year only when it differs). */
export function activityTime(iso: string, now = Date.now()) {
  const date = new Date(iso)
  const elapsed = now - date.getTime()
  if (Number.isNaN(elapsed)) return ''
  if (elapsed < MINUTE) return '방금 전'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}일 전`
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString('ko-KR', sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Exact local time for tooltips next to a relative label. */
export function exactTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
