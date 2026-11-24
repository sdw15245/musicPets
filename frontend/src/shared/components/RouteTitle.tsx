import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const BRAND = 'MusicPets'

const titles: [RegExp, string][] = [
  [/^\/login$/, '로그인'],
  [/^\/oauth\/callback$/, '로그인하는 중'],
  [/^\/community\/posts\/[^/]+$/, '음악 이야기'],
  [/^\/community$/, '커뮤니티'],
  [/^\/history$/, '분석 기록'],
  [/^\/history\/[^/]+$/, '지난 분석 결과'],
  [/^\/pets$/, '만난 펫'],
  [/^\/library$/, '음악 저장 안내'],
  [/^\/notifications$/, '알림'],
  [/^\/mypage$/, '내 프로필'],
  [/^\/(analyze|test)$/, '음악 취향 분석'],
  [/^\/result$/, '내 취향'],
]

function pageTitle(pathname: string, search = '') {
  if (pathname === '/') return `${BRAND} · 음악으로 만나는 나의 펫`
  if (pathname === '/community' && new URLSearchParams(search).get('view') === 'mine') return `내 글 · ${BRAND}`
  const title = titles.find(([pattern]) => pattern.test(pathname))?.[1] ?? '페이지를 찾을 수 없어요'
  return `${title} · ${BRAND}`
}

/** Names each screen in the tab and history, so routes stay distinguishable. */
export default function RouteTitle() {
  const { pathname, search } = useLocation()
  useEffect(() => { document.title = pageTitle(pathname, search) }, [pathname, search])
  return null
}
