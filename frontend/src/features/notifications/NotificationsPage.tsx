import { Link } from 'react-router-dom'
import { Avatar } from '@seed-design/react'
import { Badge } from 'seed-design/ui/badge'
import { ResultSection } from 'seed-design/ui/result-section'
import PersonalLayout from '../mypage/PersonalLayout'
import Button from '../../shared/components/ui/Button'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { getPet } from '../community/model'
import { useNotifications, useReadNotification } from './useNotifications'

const messages = { LIKE: '님이 내 글에 공감했어요.', COMMENT: '님이 내 글에 댓글을 남겼어요.', REPLY: '님이 내 댓글에 답글을 남겼어요.' }

export default function NotificationsPage() {
  const feed = useNotifications()
  const read = useReadNotification()
  const items = feed.data?.pages.flatMap(page => page.items) ?? []
  const count = feed.data?.pages[0]?.unreadCount
  return <PersonalLayout title="알림">
    <div className="notification-toolbar">
      <p>{count === undefined ? '알림을 확인하고 있어요.' : '읽지 않은 알림 ' + count + '개'}</p>
      <Button size="small" variant="ghost" disabled={!count || read.isPending} loading={read.isPending && read.variables === null} onClick={() => read.mutate(null)}>모두 읽음</Button>
    </div>
    {feed.isPending && <MusicListSkeleton label="알림을 불러오고 있어요." />}
    {feed.isError && <RequestErrorNotice error={feed.error} action={blocked => <Button disabled={blocked} loading={feed.isFetching} onClick={() => void feed.refetch()}>다시 불러오기</Button>}>알림을 불러오지 못했어요.</RequestErrorNotice>}
    {read.isError && <RequestErrorNotice error={read.error}>읽음 상태를 변경하지 못했어요. 다시 시도해주세요.</RequestErrorNotice>}
    {!feed.isPending && !feed.isError && !items.length && <ResultSection size="medium" title="새로운 알림이 없어요" description="내 글의 댓글과 공감, 내 댓글의 답글이 여기에 모여요." actions={<Button asChild><Link to="/community">커뮤니티 둘러보기</Link></Button>} />}
    <ul className="personal-list">{items.map(item => {
      const pet = getPet(item.avatarSlug)
      return <li className="personal-card notification-card" data-unread={!item.read} key={item.id}>
        <Link className="notification-link" to={'/community/posts/' + item.postId + '?comments=1' + (item.commentId ? '&comment=' + encodeURIComponent(item.commentId) : '')} onClick={() => { if (!item.read) read.mutate(item.id) }}>
          <Avatar.Root size="48">{pet && <Avatar.Image src={pet.imageUrl} alt="" />}<Avatar.Fallback>{item.actor.slice(0, 1)}</Avatar.Fallback></Avatar.Root>
          <span className="notification-copy"><span><strong>{item.actor}</strong>{messages[item.kind]}</span>
            {item.postPreview && <span className="notification-post-preview">{item.postPreview}</span>}
            {item.commentPreview && <span className="notification-comment-preview">{item.commentPreview}</span>}
          </span>
        </Link>
        <div className="personal-row-actions">
          <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('ko-KR')}>{new Date(item.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
          {!item.read && <><Badge tone="brand" variant="weak">새 알림</Badge><Button size="small" variant="ghost" disabled={read.isPending} onClick={() => read.mutate(item.id)}>읽음으로 표시</Button></>}
        </div>
      </li>
    })}</ul>
    {feed.hasNextPage && <Button disabled={feed.isFetchingNextPage} loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>알림 더 보기</Button>}
  </PersonalLayout>
}
