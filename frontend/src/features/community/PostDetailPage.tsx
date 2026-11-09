import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ResultSection } from 'seed-design/ui/result-section'
import AppHeader from '../../shared/components/AppHeader'
import Button from '../../shared/components/ui/Button'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { api } from '../../shared/api/client'
import { ApiError, normalizeError } from '../../shared/api/error'
import { useAuthStore } from '../auth/useAuthStore'
import { useProfile } from '../profile/useProfile'
import { CommunityPostSchema } from './schemas'
import { usePostMutations } from './usePosts'
import { getPet } from './model'
import PostCard from './PostCard'
import ShareComposer from './ShareComposer'
import '../mypage/personal.css'

export default function PostDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const commentParam = params.get('comment')
  const focusCommentId = commentParam && /^\d+$/.test(commentParam) ? commentParam : undefined
  const sessionId = useAuthStore(s => s.sessionId)
  const profile = useProfile()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<{ open: boolean } | null>(null)
  const editTrigger = useRef<HTMLElement | null>(null)
  const mutations = usePostMutations()
  const query = useQuery({
    queryKey: ['posts', sessionId, 'detail', id], retry: false, enabled: /^\d+$/.test(id),
    queryFn: async ({ signal }) => {
      try { return CommunityPostSchema.parse((await api.get('/api/posts/' + id, { signal })).data) }
      catch (error) { throw normalizeError(error) }
    },
  })
  const missing = !/^\d+$/.test(id) || (query.error instanceof ApiError && query.error.status === 404)
  const post = query.data
  const login = () => navigate('/login?next=' + encodeURIComponent('/community/posts/' + id + '?comments=1'))
  return <div className="personal-page community-page">
    <AppHeader />
    <main className="personal-main">
      <Link className="personal-back" to="/community">← 커뮤니티</Link><h1>음악 이야기</h1>
      {missing ? <ResultSection size="medium" title="글을 찾을 수 없어요" description="삭제된 글일 수 있어요. 다른 음악 이야기를 둘러보세요." actions={<Button asChild><Link to="/community">커뮤니티로 가기</Link></Button>} /> :
        query.isPending ? <MusicListSkeleton label="글을 불러오고 있어요." /> :
        query.isError && <RequestErrorNotice error={query.error} action={blocked => <Button disabled={blocked} onClick={() => void query.refetch()}>다시 불러오기</Button>}>글을 불러오지 못했어요.</RequestErrorNotice>}
      {mutations.like.isError && <RequestErrorNotice error={mutations.like.error}>공감을 변경하지 못했어요.</RequestErrorNotice>}
      {post && <PostCard key={`${post.id}:${focusCommentId ?? ''}`} post={post} liked={post.liked} initialCommentsOpen={params.get('comments') === '1' || !!focusCommentId} focusCommentId={focusCommentId}
        onRequireLogin={login} onLike={() => { if (!profile.signedIn) { login(); return } return mutations.likePost({ id, liked: !post.liked }) }}
        liking={mutations.pendingLikeIds.has(id)} onEdit={() => { editTrigger.current = document.activeElement as HTMLElement; setEditing({ open: true }) }} deleting={mutations.remove.isPending}
        onDelete={async () => { await mutations.remove.mutateAsync(id); navigate('/community', { replace: true }) }} />}
      {post && editing && <ShareComposer open={editing.open} initialPost={post} authorName={profile.name} pet={getPet(profile.avatarSlug)} onClose={() => setEditing({ open: false })}
        onExitComplete={() => { setEditing(null); editTrigger.current?.focus() }}
        onPublish={async (track, caption, tags) => { await mutations.save.mutateAsync({ id, trackUri: track.uri, caption, tags }); setEditing({ open: false }) }} />}
    </main>
  </div>
}
