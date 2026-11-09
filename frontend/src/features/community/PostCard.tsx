import { spotifyUrl, spotifyTrackId } from '../../shared/spotify'
import SpotifyPlayer from '../../shared/components/SpotifyPlayer'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import Button from '../../shared/components/ui/Button'
import { Avatar, ReactionButton, Icon } from '@seed-design/react'
import { Badge } from 'seed-design/ui/badge'
import CommunityIcon from './CommunityIcon'
import TrackArtwork from './TrackArtwork'
import { getPet, type CommunityPost } from './model'
import { useId, useState } from 'react'
import PostComments from './PostComments'
import DeleteConfirmDialog from '../../shared/components/ui/DeleteConfirmDialog'
import { Link } from 'react-router-dom'

interface PostCardProps {
  post: CommunityPost
  liked: boolean
  onLike: () => Promise<boolean> | void
  onDelete: () => Promise<void>
  onEdit: () => void
  onRequireLogin: () => void
  deleting?: boolean
  liking?: boolean
  initialCommentsOpen?: boolean
  focusCommentId?: string
}

function PostCard({ post, liked, onLike, onDelete, onEdit, onRequireLogin, deleting, liking, initialCommentsOpen = false, focusCommentId }: PostCardProps) {
  const commentsId = useId()
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen)
  const [commentsOpened, setCommentsOpened] = useState(initialCommentsOpen)
  const [likeFeedback, setLikeFeedback] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteCause, setDeleteCause] = useState<unknown>(null)
  const postPath = `/community/posts/${encodeURIComponent(post.id)}`
  const avatar = getPet(post.avatarSlug === undefined ? post.petSlug : post.avatarSlug)
  const likeCount = post.likes
  const dateLabel = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '오늘의 추천 · 샘플'
  const authorAvatar = <Avatar.Root size="48" style={{ backgroundColor: avatar?.color }} aria-hidden="true">
    {avatar && <Avatar.Image src={avatar.imageUrl} alt="" />}
    <Avatar.Fallback>{post.author === 'GUEST' ? 'GUEST' : post.author.slice(0, 1)}</Avatar.Fallback>
  </Avatar.Root>

  return (
    <article className={`community-post${post.own ? ' post-own' : ''}`} aria-label={`${post.author}의 음악 공유`}>
      <header className="post-header">
        {post.own ? <Link to="/mypage" className="community-avatar-link" aria-label="내 프로필 사진 — 내 프로필">{authorAvatar}</Link> : authorAvatar}
        <div className="post-byline">
          <div>
            {post.own ? <Link to="/mypage" className="community-author-link" aria-label={`${post.author} — 내 프로필`}><strong>{post.author}</strong></Link> : <strong>{post.author}</strong>}
            {post.own && <Badge size="medium" tone="neutral" variant="weak">나</Badge>}
          </div>
          <Link to={postPath} className="post-time" aria-label="글 보기" title={`${dateLabel} · 글 보기`}>{dateLabel}</Link>
        </div>
        {post.own && (
          <div className="post-owner-actions"><Button variant="ghost" size="small" onClick={onEdit}>수정</Button>
          <Button variant="ghost" size="small" layout="iconOnly" aria-label="내 글 삭제" aria-haspopup="dialog" onClick={() => { setDeleteError(''); setConfirmDelete(true) }}>
            <Icon svg={<CommunityIcon name="trash" />} />
          </Button></div>
        )}
      </header>
      {post.own && <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete}
        title="게시글을 삭제할까요?" description="이 글과 댓글이 함께 삭제돼요. 삭제한 내용은 되돌릴 수 없어요."
        busy={deleting} error={deleteError} cause={deleteCause} onConfirm={async () => {
          if (deleting) return
          setDeleteError('')
          try { await onDelete(); setConfirmDelete(false) }
          catch (cause) { setDeleteCause(cause); setDeleteError('글을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.') }
        }} />}
      <div className="post-body">
      {spotifyTrackId(post.track.uri) ? <SpotifyPlayer uri={post.track.uri} name={post.track.name} /> : <a className="post-track" href={spotifyUrl(post.track)} target="_blank" rel="noreferrer"
        aria-label={`${post.track.name} Spotify에서 열기`}>
        <TrackArtwork track={post.track} />
        <div className="post-trackinfo">
          <strong>{post.track.name}</strong>
          <span>{post.track.artist}</span>
          <small>Spotify에서 듣기 <CommunityIcon name="external" /></small>
          {post.track.uri && <SpotifyLogo />}
        </div>
        <span className="post-record" aria-hidden="true"><CommunityIcon name="music" /></span>
      </a>}
      <div className="post-story">
        <p className="post-caption">{post.caption}</p>
        <div className="post-tags">{post.tags.map(tag => <span className="post-tag" key={tag}>#{tag}</span>)}</div>
      </div>
      </div>
      <footer className="seed-post-actions">
        <ReactionButton aria-label={`공감 ${likeCount}`} pressed={liked} loading={liking} disabled={liking} onPressedChange={async () => {
          if (await onLike()) setLikeFeedback(value => value + 1)
        }}>
          <span key={`icon-${likeFeedback}`} className={`post-reaction-icon${likeFeedback ? ' post-reaction-confirmed' : ''}`}><Icon svg={<CommunityIcon name={liked ? 'heartFilled' : 'heart'} />} /></span>
          <span>공감 <span key={`count-${likeFeedback}`} className={likeFeedback ? 'post-count-confirmed' : undefined}>{likeCount}</span></span>
        </ReactionButton>
        <Button variant="ghost" size="small" aria-expanded={commentsOpen} aria-controls={commentsOpened ? commentsId : undefined} onClick={() => { setCommentsOpened(true); setCommentsOpen(!commentsOpen) }}>댓글 {post.commentCount}개</Button>
      </footer>
      {commentsOpened && <div hidden={!commentsOpen}><PostComments id={commentsId} postId={post.id} focusCommentId={focusCommentId} onRequireLogin={onRequireLogin} /></div>}
    </article>
  )
}

export default PostCard
