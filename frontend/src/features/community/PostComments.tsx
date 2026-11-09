import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, Field, TextField } from '@seed-design/react'
import Button from '../../shared/components/ui/Button'
import { useProfile } from '../profile/useProfile'
import { getPet } from './model'
import { useComments, useCommentMutations } from './useComments'
import { ApiError } from '../../shared/api/error'
import DeleteConfirmDialog from '../../shared/components/ui/DeleteConfirmDialog'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import { useRequestLimit } from '../../shared/api/useRequestLimit'
import LoadingStatus from '../../shared/components/ui/LoadingStatus'
import { useSuccessNotice } from '../../shared/components/ui/useSuccessNotice'
import { Link } from 'react-router-dom'
import CommentActionsMenu from './CommentActionsMenu'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '다시 로그인한 뒤 시도해주세요.'
    if (error.status === 403) return '본인 댓글만 변경할 수 있어요.'
    if (error.status === 404) return '글이나 댓글이 삭제되었어요. 목록을 다시 불러와주세요.'
    if (error.status === 400) return '댓글 내용이나 답글을 달 원댓글의 상태를 확인해주세요.'
  }
  return fallback
}

function CommentForm({ label, submitLabel, body, onBodyChange, busy, onSubmit, onCancel }: {
  label: string; submitLabel: string; body: string; onBodyChange: (body: string) => void
  busy: boolean; onSubmit: (body: string) => Promise<void>; onCancel?: () => void
}) {
  const [error, setError] = useState<unknown>(null)
  const limit = useRequestLimit([error])
  const [submitting, setSubmitting] = useState(false)
  const disabled = busy || submitting
  return <form className="comment-form" onSubmit={async event => {
    event.preventDefault()
    if (!body.trim() || disabled || limit?.blocked) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(body.trim())
    } catch (cause) {
      setError(cause)
    } finally { setSubmitting(false) }
  }}>
    <Field.Root>
      <Field.Header><Field.Label>{label}</Field.Label></Field.Header>
      <TextField.Root size="medium" value={body} onValueChange={onBodyChange}>
        <TextField.Textarea className="comment-textarea" style={{ minHeight: 95, maxHeight: 200 }} autoFocus={!!onCancel} disabled={disabled} maxLength={500} placeholder="이 곡은 어땠나요?" />
      </TextField.Root>
      <Field.Footer className="comment-form-footer">
        <Field.CharacterCount current={body.length} max={500} />
        <div className="comment-actions">
          {onCancel && <Button type="button" size="small" variant="ghost" disabled={disabled} onClick={onCancel}>취소</Button>}
          <Button type="submit" size="small" loading={submitting} disabled={disabled || !body.trim() || limit?.blocked}>{submitLabel}</Button>
        </div>
      </Field.Footer>
    </Field.Root>
    {limit ? <RequestLimitNotice limit={limit} /> : !!error && <ErrorNotice>{errorMessage(error, '댓글을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')}</ErrorNotice>}
  </form>
}

export default function PostComments({ id, postId, focusCommentId, onRequireLogin }: { id: string; postId: string; focusCommentId?: string; onRequireLogin: () => void }) {
  const profile = useProfile()
  const feed = useComments(postId, focusCommentId)
  const focusedTarget = useRef<string | null>(null)
  const { save, remove } = useCommentMutations(postId)
  const busy = save.isPending || remove.isPending
  const [activeForm, setActiveForm] = useState<{ mode: 'edit' | 'reply'; commentId: string } | null>(null)
  // Forms may unmount when switching tasks; their drafts belong to this comment panel.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirmation, setConfirmation] = useState<{ id: string; revision: number } | null>(null)
  const confirmedCommentRef = useRef<HTMLLIElement>(null)
  const revealedRevision = useRef(0)
  const formTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteCause, setDeleteCause] = useState<unknown>(null)
  const notifySuccess = useSuccessNotice()
  const comments = feed.data?.pages.flatMap(page => page.items) ?? []
  useLayoutEffect(() => {
    if (!focusCommentId || focusedTarget.current === focusCommentId) return
    const target = document.getElementById(`comment-${postId}-${focusCommentId}`)
    if (!target || target.closest('[hidden]')) return
    focusedTarget.current = focusCommentId
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [focusCommentId, postId, feed.data])
  const missingTarget = !!focusCommentId && (feed.error instanceof ApiError && feed.error.status === 404
    || feed.isSuccess && !comments.some(comment => comment.id === focusCommentId && !comment.deleted))
  useLayoutEffect(() => {
    if (activeForm || busy) return
    const trigger = formTriggerRef.current
    formTriggerRef.current = null
    if (trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus()
  }, [activeForm, busy])
  useLayoutEffect(() => {
    const element = confirmedCommentRef.current
    if (!confirmation || !element || revealedRevision.current === confirmation.revision) return
    revealedRevision.current = confirmation.revision
    if (element.closest('[hidden]')) return
    element.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [confirmation, feed.data])
  const confirmComment = (id: string) => setConfirmation(current => ({ id, revision: (current?.revision ?? 0) + 1 }))
  const setDraft = (key: string, body: string) => setDrafts(current => ({ ...current, [key]: body }))
  const clearDraft = (key: string) => setDrafts(current => {
    const next = { ...current }
    delete next[key]
    return next
  })
  const add = async (body: string, parentId: string | null) => {
    const saved = await save.mutateAsync({ body, parentId })
    confirmComment(saved.id)
    clearDraft(parentId ? `reply:${parentId}` : 'comment')
    if (parentId) setActiveForm(null)
    notifySuccess(parentId ? '답글을 등록했어요.' : '댓글을 등록했어요.')
  }
  const deleteComment = async (id: string) => {
    if (busy) return
    setDeleteError('')
    try {
      await remove.mutateAsync(id)
      setDeleting(null)
      clearDraft(`edit:${id}`)
      clearDraft(`reply:${id}`)
      if (activeForm?.commentId === id) setActiveForm(null)
      notifySuccess('댓글을 삭제했어요.')
    } catch (cause) { setDeleteCause(cause); setDeleteError(errorMessage(cause, '댓글을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.')) }
  }
  const render = (comment: typeof comments[number]): ReactNode => {
    const own = profile.signedIn && comment.own
    const avatarSlug = own ? profile.avatarSlug : comment.avatarSlug
    const avatar = getPet(avatarSlug)
    const name = own ? profile.name : comment.author
    const editKey = `edit:${comment.id}`
    const replyKey = `reply:${comment.id}`
    const editing = activeForm?.mode === 'edit' && activeForm.commentId === comment.id
    const replying = activeForm?.mode === 'reply' && activeForm.commentId === comment.id
    const parent = comment.parentId ? comments.find(item => item.id === comment.parentId) : undefined
    const replyTarget = parent && !parent.deleted ? (profile.signedIn && parent.own ? profile.name : parent.author) : null
    const authorAvatar = <Avatar.Root size="36" aria-hidden="true">
      {avatar && <Avatar.Image src={avatar.imageUrl} alt="" />}
      <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
    </Avatar.Root>
    return <li id={`comment-${postId}-${comment.id}`} tabIndex={-1} key={comment.id} className="post-comment" ref={confirmation?.id === comment.id ? confirmedCommentRef : undefined}>
      {comment.deleted ? <p className="comment-deleted">삭제된 댓글입니다.</p> : <div className="comment-row">
        {(confirmation?.id === comment.id || focusCommentId === comment.id) && <span key={confirmation?.revision ?? 'notification'} className="comment-confirmation" aria-hidden="true" />}
        {own ? <Link to="/mypage" className="community-avatar-link" aria-label="내 프로필 사진 — 내 프로필">{authorAvatar}</Link> : authorAvatar}
        <div className="comment-content">
          <div className="comment-header">
            <div className="comment-author">
              {own ? <Link to="/mypage" className="community-author-link" aria-label={`${name} — 내 프로필`}><strong>{name}</strong></Link> : <strong>{name}</strong>}
              {own && <span className="comment-own-label">나</span>}
              <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString('ko-KR')}>{new Date(comment.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })}</time>
            </div>
            {own && <CommentActionsMenu disabled={busy} onEdit={trigger => {
              formTriggerRef.current = trigger
              setActiveForm({ mode: 'edit', commentId: comment.id })
            }} onDelete={() => { setDeleting(comment.id); setDeleteError(''); setDeleteCause(null) }} />}
          </div>
          {replyTarget && <p className="comment-reply-target">{replyTarget}에게 답글</p>}
          {editing ? <CommentForm label="댓글 수정" submitLabel="수정 완료" body={drafts[editKey] ?? comment.body} onBodyChange={body => setDraft(editKey, body)} busy={busy}
            onCancel={() => setActiveForm(null)} onSubmit={async body => { await save.mutateAsync({ id: comment.id, body }); confirmComment(comment.id); clearDraft(editKey); setActiveForm(null); notifySuccess('댓글을 수정했어요.') }} /> : <p className="comment-body">{comment.body}</p>}
          {!comment.parentId && <div className="comment-actions comment-reply-action">
            <Button size="small" variant="ghost" color="fg.neutralMuted" disabled={busy} aria-expanded={replying} aria-controls={`${id}-reply-${comment.id}`} onClick={event => {
              if (!profile.signedIn) { onRequireLogin(); return }
              formTriggerRef.current = event.currentTarget
              setActiveForm(replying ? null : { mode: 'reply', commentId: comment.id })
            }}>답글</Button>
          </div>}
        </div>
      </div>}
      {!comment.parentId && <>
        <div id={`${id}-reply-${comment.id}`} className="comment-reply-form" hidden={!replying || comment.deleted}>
          {replying && !comment.deleted && <CommentForm label={`${name}에게 답글`} submitLabel="답글 등록" body={drafts[replyKey] ?? ''} onBodyChange={body => setDraft(replyKey, body)} busy={busy} onCancel={() => setActiveForm(null)} onSubmit={body => add(body, comment.id)} />}
        </div>
        <ul className="comment-replies">{comments.filter(reply => reply.parentId === comment.id).map(render)}</ul>
      </>}
    </li>
  }
  return <section id={id} className="post-comments" aria-label="댓글">
    <DeleteConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null) }}
      title="댓글을 삭제할까요?" description="삭제한 내용은 되돌릴 수 없어요. 다른 사람이 남긴 답글은 유지돼요."
      busy={remove.isPending} error={deleteError} cause={deleteCause} onConfirm={() => { if (deleting) void deleteComment(deleting) }} />
    {feed.isPending && <LoadingStatus>댓글을 불러오고 있어요.</LoadingStatus>}
    {missingTarget && <p role="status">알림의 댓글을 찾을 수 없어요. 삭제된 댓글일 수 있어요.</p>}
    {focusCommentId && <Button asChild variant="ghost" size="small"><Link to={`/community/posts/${postId}?comments=1`}>전체 댓글 보기</Link></Button>}
    {feed.isError && !missingTarget && <RequestErrorNotice error={feed.error} action={blocked => <Button size="small" disabled={blocked} loading={feed.isFetching} onClick={() => void feed.refetch()}>댓글 다시 불러오기</Button>}>댓글을 불러오지 못했어요.</RequestErrorNotice>}
    {!feed.isPending && !feed.isError && !comments.length && <p>첫 댓글을 남겨보세요.</p>}
    <ul className="comment-list">{comments.filter(comment => !comment.parentId).map(render)}</ul>
    {feed.hasNextPage && <Button size="small" loading={feed.isFetchingNextPage} disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>댓글 더 보기</Button>}
    <div className="comment-composer">
      {profile.signedIn ? <CommentForm label="댓글 입력" submitLabel="댓글 등록" body={drafts.comment ?? ''} onBodyChange={body => setDraft('comment', body)} busy={busy} onSubmit={body => add(body, null)} />
        : <Button onClick={onRequireLogin}>로그인하고 댓글 남기기</Button>}
    </div>
  </section>
}
