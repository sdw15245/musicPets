import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppHeader from './AppHeader'
import MusicListSkeleton from './ui/MusicListSkeleton'
import PersonalLayout from '../../features/mypage/PersonalLayout'
import ResultLayout from '../../features/result/ResultLayout'
import ResultSkeleton from '../../features/result/ResultSkeleton'
import ProfileSkeleton from '../../features/mypage/ProfileSkeleton'
import '../../features/mypage/mypage.css'

// Public structure only: protected page modules and their queries stay unmounted.
export default function PagePending({ label = '화면을 불러오고 있어요.', children }: { label?: string; children?: ReactNode }) {
  const { pathname, search } = useLocation()
  const content = children ?? <MusicListSkeleton compact label={label} quiet />
  if (pathname === '/result') return <ResultLayout pending>{children ?? <ResultSkeleton label={label} />}</ResultLayout>
  if (pathname === '/history') return <PersonalLayout pending taste title="분석 기록" description="최근 10회의 음악 취향을 보관해요. 새 기록이 쌓이면 가장 오래된 기록부터 정리돼요.">{content}</PersonalLayout>
  if (pathname.startsWith('/history/')) return <PersonalLayout pending taste title="지난 분석 결과" description="그날의 음악 취향을 다시 만나보세요.">{content}</PersonalLayout>
  if (pathname === '/pets') return <PersonalLayout pending taste title="만난 펫" description="음악 취향을 분석하며 만난 펫들이에요.">{content}</PersonalLayout>
  if (pathname === '/notifications') return <PersonalLayout pending title="알림" description="내 글과 이야기에 남겨진 반응을 확인해요.">{content}</PersonalLayout>
  if (pathname === '/library') return <PersonalLayout pending title="음악 저장 안내" description="음악 보관함은 더 이상 제공하지 않아요.">{content}</PersonalLayout>
  if (pathname === '/mypage') return <div className="mypage"><AppHeader pending /><main className="mypage-overview">
    <h1>내 프로필</h1><p>커뮤니티에서 사용하는 이름과 내가 쓴 글을 관리해요.</p>
    {children ?? <div className="mypage-layout">
      <section className="mypage-profile-card" aria-label="내 프로필"><ProfileSkeleton label={label} quiet /></section>
      <section className="mypage-recent" aria-label="최근 내 글">
        <div className="mypage-recent-heading"><h2>최근 내 글</h2></div>
        <MusicListSkeleton compact quiet label="내 글을 불러오고 있어요." />
      </section>
    </div>}
  </main></div>
  if (pathname === '/community') {
    const mine = new URLSearchParams(search).get('view') === 'mine'
    return <div className="community-page"><AppHeader pending /><div className="community-layout">
      <aside className="community-sidebar" aria-hidden="true" />
      <main className="community-feed"><div className="community-feedheading"><div>
        <h1>{mine ? '내 글' : '오늘, 어떤 음악 들었어요?'}</h1>
        <p>{mine ? '내가 공유한 음악과 이야기를 확인해요.' : '한 곡과 한 문장으로, 서로의 취향을 만나보세요.'}</p>
      </div></div>{content}</main>
    </div></div>
  }
  if (pathname.startsWith('/community/posts/')) return <div className="personal-page community-page"><AppHeader pending /><main className="personal-main">
    <Link className="personal-back" to="/community">← 커뮤니티</Link><h1>음악 이야기</h1>{content}
  </main></div>
  return <div className="personal-page"><AppHeader pending /><main className="personal-main">{content}</main></div>
}
