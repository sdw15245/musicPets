import AppHeader from '../../shared/components/AppHeader'
import { Link } from 'react-router-dom'
import Button from '../../shared/components/ui/Button'
import './mypage.css'
import './personal.css'
import ProfileEditor from '../profile/ProfileEditor'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Avatar } from '@seed-design/react'
import ProfileSkeleton from './ProfileSkeleton'
import { ResultSection } from 'seed-design/ui/result-section'
import { IconMusicalnoteDoubleLine } from '@karrotmarket/react-monochrome-icon'
import { useProfile } from '../profile/useProfile'
import { getPet } from '../community/model'
import { usePosts } from '../community/usePosts'
import TrackArtwork from '../community/TrackArtwork'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import { spotifyUrl } from '../../shared/spotify'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'

function ProfileSummary({ profile }: { profile: ReturnType<typeof useProfile> }) {
  const [editing, setEditing] = useState(false)
  const editorId = useId()
  const editTrigger = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const pet = getPet(profile.petSlug)
  useLayoutEffect(() => {
    if (editing || profile.saving || !restoreFocus.current) return
    restoreFocus.current = false
    editTrigger.current?.focus()
  }, [editing, profile.saving])
  const closeEditor = () => {
    restoreFocus.current = true
    setEditing(false)
  }
  return <>
    <div className="mypage-profile-identity">
      <Avatar.Root size="64">
        {pet && <Avatar.Image src={pet.imageUrl} alt="분석 펫 프로필 사진" />}
        <Avatar.Fallback>{profile.name.slice(0, 1) || '?'}</Avatar.Fallback>
      </Avatar.Root>
      <div>
        <h2>{profile.name}</h2>
        <p className="mypage-profile-description">{pet ? `나의 펫 · ${pet.name}` : '아직 음악 펫을 만나기 전이에요.'}</p>
      </div>
    </div>
    <div className="mypage-profile-body">
      <Button ref={editTrigger} size="small" aria-expanded={editing} aria-controls={editing ? editorId : undefined} disabled={profile.saving}
        onClick={() => setEditing(!editing)}>이름 수정</Button>
      {editing && <div id={editorId}><ProfileEditor profile={profile} onClose={closeEditor} /></div>}
      <div className="mypage-connected-account">
        <div><span>Spotify 계정</span><strong>{profile.spotifyId}</strong></div>
        <Button asChild variant="ghost" size="small"><Link to="/login?switchAccount=true">계정 변경</Link></Button>
      </div>
    </div>
  </>
}

function RecentPosts() {
  const feed = usePosts('mine', 'all', undefined, 'latest', '')
  const posts = feed.data?.pages[0]?.items.slice(0, 3) ?? []
  return <section className="mypage-recent" aria-labelledby="recent-posts-title">
    <div className="mypage-recent-heading">
      <h2 id="recent-posts-title">최근 내 글</h2>
      <Button asChild size="small" variant="ghost"><Link to="/community?view=mine" aria-label="내 글 전체 보기">전체 보기</Link></Button>
    </div>
    {feed.isPending && <MusicListSkeleton compact label="내 글을 불러오고 있어요." />}
    {feed.isError && <RequestErrorNotice error={feed.error} action={blocked => <Button size="small" disabled={blocked} loading={feed.isFetching} onClick={() => void feed.refetch()}>내 글 다시 불러오기</Button>}>내 글을 불러오지 못했어요.</RequestErrorNotice>}
    {!feed.isPending && !feed.isError && !posts.length && <ResultSection size="medium"
      asset={<IconMusicalnoteDoubleLine size={32} aria-hidden="true" />}
      title="아직 공유한 음악이 없어요" description="좋아하는 한 곡과 짧은 이야기를 남겨보세요."
      actions={<Button asChild variant="brandSolid"><Link to="/community">음악 공유하러 가기</Link></Button>} />}
    <div className="mypage-recent-posts">{posts.map(post => <article className="mypage-post-preview" key={post.id} aria-label={`${post.track.name} 공유글`}>
      <Link className="mypage-track" to={'/community/posts/' + post.id} aria-label={`${post.track.name} 글 보기`}>
        <TrackArtwork track={post.track} />
        <div className="mypage-track-info"><h3>{post.track.name}</h3><span>{post.track.artist}</span><p className="mypage-post-caption">{post.caption}</p></div>
      </Link>
      <div className="mypage-post-meta">
        <div>
        {post.createdAt && <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</time>}
        <span>공감 {post.likes} · 댓글 {post.commentCount}개</span>
        </div>
        <a className="mypage-spotify-link" href={spotifyUrl(post.track)} target="_blank" rel="noreferrer" aria-label={`${post.track.name} Spotify에서 듣기`}><SpotifyLogo />에서 듣기</a>
      </div>
    </article>)}</div>
  </section>
}

export default function MyPage() {
  const profile = useProfile()
  return <div className="mypage">
    <AppHeader />
    <main className="mypage-overview" aria-labelledby="mypage-title">
      <h1 id="mypage-title">내 프로필</h1>
      <div className="mypage-layout">
        <section className="mypage-profile-card" aria-label="내 프로필">
          {profile.loading ? <ProfileSkeleton />
            : profile.error ? <div className="mypage-profile-body"><RequestErrorNotice error={profile.error} action={blocked => <Button disabled={blocked} onClick={() => void profile.reload()}>다시 불러오기</Button>}>프로필을 불러오지 못했어요.</RequestErrorNotice></div>
            : <ProfileSummary key={profile.owner} profile={profile} />}
        </section>
        <RecentPosts />
      </div>
    </main>
  </div>
}
