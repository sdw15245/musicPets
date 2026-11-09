// 로그인 후에는 조회 화면으로만 복귀한다. 분석 실행은 로그인 후 사용자가 직접 시작한다.
export function loginDestination(path: string | null) {
  if (!path) return '/'
  const pathname = path.split(/[?#]/, 1)[0]
  if (/^\/community\/posts\/\d+$/.test(pathname)) return pathname + (new URLSearchParams(path.split('?')[1] ?? '').get('comments') === '1' ? '?comments=1' : '')
  if (/^\/history\/[A-Za-z0-9-]+$/.test(pathname)) return pathname
  if (!['/', '/community', '/mypage', '/result', '/history', '/pets', '/library', '/notifications'].includes(pathname)) return '/'
  if (pathname !== '/community') return pathname
  const query = path.split('#', 1)[0].split('?')[1] ?? ''
  const params = new URLSearchParams(query)
  const supported = new URLSearchParams()
  for (const key of ['view', 'pet', 'q', 'sort', 'filter']) {
    const value = params.get(key)
    if (value) supported.set(key, value)
  }
  const search = supported.toString()
  return search ? `${pathname}?${search}` : pathname
}
