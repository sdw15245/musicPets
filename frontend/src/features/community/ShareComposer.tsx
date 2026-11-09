import { useEffect, useRef, useState } from 'react'
import { ResponsiveDialog, AlertDialog, Field, TextField, Portal, ResponsivePair, Chip } from '@seed-design/react'
import Button from '../../shared/components/ui/Button'
import TrackArtwork from './TrackArtwork'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import { spotifyUrl, spotifyTrackId } from '../../shared/spotify'
import { type CommunityTrack, type Pet } from './model'
import TrackSearch from './TrackSearch'
import { normalizeError, isSpotifyReauthorizationRequired } from '../../shared/api/error'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import { useRequestLimit } from '../../shared/api/useRequestLimit'
import type { CommunityPost } from './schemas'
import { IconXmarkLine } from '@karrotmarket/react-monochrome-icon'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'

interface ShareComposerProps {
  open: boolean
  initialTrack?: CommunityTrack
  initialPost?: CommunityPost
  authorName: string
  pet?: Pet
  onClose: () => void
  onExitComplete: () => void
  onPublish: (track: CommunityTrack, caption: string, tags: string[]) => Promise<void>
}

function ShareComposer({ open, initialTrack, initialPost, authorName, pet, onClose, onPublish, onExitComplete }: ShareComposerProps) {
  const [track, setTrack] = useState<CommunityTrack | undefined>(initialPost?.track ?? initialTrack)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const limit = useRequestLimit([submitError])
  const [caption, setCaption] = useState(initialPost?.caption ?? '')
  const [tags, setTags] = useState<string[]>(initialPost?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState('')
  const [composingTag, setComposingTag] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const tagListRef = useRef<HTMLDivElement>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dirty = initialPost ? track !== initialPost.track || caption !== initialPost.caption || tagInput.length > 0
    || JSON.stringify(tags) !== JSON.stringify(initialPost.tags)
    : !!(track || caption || tags.length || tagInput)
  const addTag = () => {
    if (composingTag || submitting) return
    const value = tagInput.trim().replace(/^#+/, '')
    if (!value) { setTagInput(''); setTagError(''); return }
    if (/\s|#/.test(value)) { setTagError('태그는 공백이나 # 없이 입력해주세요.'); return }
    if (tags.includes(value)) { setTagInput(''); setTagError(''); return }
    if (tags.length >= 5) { setTagError('태그는 최대 5개까지 추가할 수 있어요.'); return }
    setTags([...tags, value])
    setTagInput('')
    setTagError('')
    requestAnimationFrame(() => tagListRef.current?.scrollIntoView({ block: 'nearest' }))
  }
  const requestOpenChange = (next: boolean) => {
    if (submitting) return
    if (!next && dirty) setConfirmDiscard(true)
    else if (!next) onClose()
  }

  useEffect(() => {
    if (!dirty || !open) return
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [dirty, open])

  return <><ResponsiveDialog.Root open={open} onOpenChange={requestOpenChange}
    dialogRootProps={{ size: 'large', closeOnInteractOutside: false, modal: !confirmDiscard, closeOnEscape: !confirmDiscard }}
    bottomSheetRootProps={{ closeOnInteractOutside: false, modal: !confirmDiscard, closeOnEscape: !confirmDiscard }}>
    <Portal>
      <ResponsiveDialog.Positioner className="share-dialog-layer">
        <ResponsiveDialog.Backdrop />
        <ResponsiveDialog.Content className="seed-share-dialog" onAnimationEnd={event => {
          // A breakpoint switch replaces the focus scope; restore the persistent trigger on exit.
          if (!open && event.target === event.currentTarget) onExitComplete()
        }}>
          <ResponsiveDialog.Header className="share-dialog-header">
            <ResponsiveDialog.Title>{initialPost ? '게시글 수정' : '오늘의 한 곡'}</ResponsiveDialog.Title>
            <ResponsiveDialog.Description>음악을 고르고, 나누고 싶은 이야기를 남겨주세요.</ResponsiveDialog.Description>
          </ResponsiveDialog.Header>
          <ResponsiveDialog.Body className="share-dialog-body">
            <form id="share-form" className="seed-share-form" onSubmit={async (event) => {
              event.preventDefault()
              if (submitting || limit?.blocked) return
              if (tagInput.trim()) { setTagError('입력한 태그를 추가 버튼이나 Enter로 추가하거나 지워주세요.'); tagInputRef.current?.focus(); return }
              if (!track || !spotifyTrackId(track.uri) || !caption.trim()) return
              setSubmitting(true); setSubmitError(null)
              try { await onPublish(track, caption.trim(), tags) }
              catch (error) { setSubmitError(normalizeError(error)) }
              finally { setSubmitting(false) }
            }}>
              <section className="seed-share-section" aria-label="음악 선택" inert={submitting}>
                <h3>나누고 싶은 음악</h3>
                {track ? <div className="share-selected">
                  <TrackArtwork track={track} />
                  <div><strong>{track.name}</strong><span>{track.artist}</span>
                    {track.uri && <a href={spotifyUrl(track)} target="_blank" rel="noreferrer" aria-label={`${track.name} Spotify에서 열기`}><SpotifyLogo /></a>}
                  </div>
                  <Button type="button" size="small" variant="ghost" onClick={() => setTrack(undefined)}>곡 변경</Button>
                </div> : <TrackSearch onSelect={setTrack} />}
              </section>
              <section className="seed-share-section" aria-label="음악 이야기" inert={submitting}>
                <Field.Root>
                  <Field.Header><Field.Label>이 곡을 나누고 싶은 이유</Field.Label></Field.Header>
                  <TextField.Root value={caption} onValueChange={setCaption}>
                    <TextField.Textarea maxLength={280} placeholder="어떤 순간에 듣고 싶은 곡인가요?" style={{ height: 160, minHeight: 128, maxHeight: 240, overflowY: 'auto' }} autoresize={false} />
                  </TextField.Root>
                  <Field.Footer><Field.Description>곡 선택과 이야기를 작성하면 공유할 수 있어요.</Field.Description><Field.CharacterCount current={caption.length} max={280} /></Field.Footer>
                </Field.Root>
                <Field.Root invalid={!!tagError}>
                  <Field.Header><Field.Label>태그</Field.Label></Field.Header>
                  <div className="share-tag-entry">
                  <TextField.Root value={tagInput} onValueChange={value => { setTagInput(value); setTagError('') }}>
                    <TextField.Input ref={tagInputRef} placeholder="예: 밤산책" maxLength={30} autoComplete="off" onKeyDown={event => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      if (event.nativeEvent.isComposing || event.keyCode === 229) return
                      addTag()
                    }} onCompositionStart={() => setComposingTag(true)} onCompositionEnd={() => setComposingTag(false)} />
                  </TextField.Root>
                  <Button type="button" disabled={!tagInput.trim() || composingTag || submitting}
                    onClick={() => { addTag(); tagInputRef.current?.focus() }}>추가</Button>
                  </div>
                  <Field.Footer>
                    {tagError ? <Field.ErrorMessage>{tagError}</Field.ErrorMessage> : <Field.Description>선택 사항 · {tags.length}/5개 · 각 30자 · 추가 버튼이나 Enter로 추가해요.</Field.Description>}
                  </Field.Footer>
                  <div ref={tagListRef} className="share-tags" aria-label="추가한 태그">
                    {tags.map(value => <Chip.Button key={value} type="button" size="small" variant="outlineWeak" aria-label={`#${value} 삭제`} onClick={() => { setTags(tags.filter(tag => tag !== value)); setTagError('') }}>
                      <Chip.Label>#{value}</Chip.Label><IconXmarkLine size={16} aria-hidden="true" />
                    </Chip.Button>)}
                  </div>
                </Field.Root>
              </section>
            </form>
            {limit ? <RequestLimitNotice limit={limit} /> : isSpotifyReauthorizationRequired(submitError)
              ? <SpotifyReconnectNotice /> : !!submitError && <ErrorNotice>글을 저장하지 못했어요. 입력한 내용은 유지돼요. 잠시 후 다시 시도해주세요.</ErrorNotice>}
          </ResponsiveDialog.Body>
          <ResponsiveDialog.Footer className="share-dialog-footer">
            <div className="seed-share-footer">
              <div className="share-identity">
                {pet && <img src={pet.imageUrl} alt={pet.name} />}
                <span>{authorName} 이름으로 {initialPost ? '수정해요.' : '공유돼요.'}
                  <small>오늘의 음악에 공개돼요.</small>
                </span>
              </div>
              <ResponsivePair gap="x2" className="seed-dialog-actions">
                <ResponsiveDialog.Action asChild><Button type="button" disabled={submitting}>취소</Button></ResponsiveDialog.Action>
                <Button form="share-form" type="submit" variant="brandSolid" loading={submitting} disabled={!track || !spotifyTrackId(track.uri) || !caption.trim() || submitting || limit?.blocked}>{initialPost ? '수정 완료' : '공유하기'}</Button>
              </ResponsivePair>
            </div>
          </ResponsiveDialog.Footer>
        </ResponsiveDialog.Content>
      </ResponsiveDialog.Positioner>
    </Portal>
  </ResponsiveDialog.Root>
    <AlertDialog.Root open={confirmDiscard} onOpenChange={setConfirmDiscard}>
      <Portal><AlertDialog.Positioner className="share-discard-layer">
        <AlertDialog.Backdrop />
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>작성 중인 글을 삭제할까요?</AlertDialog.Title>
            <AlertDialog.Description>선택한 음악과 이야기가 사라져요. 계속 작성할 수 있어요.</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <ResponsivePair gap="x2">
              <AlertDialog.Action asChild><Button>계속 작성하기</Button></AlertDialog.Action>
              <AlertDialog.Action asChild><Button variant="criticalSolid" onClick={onClose}>작성 취소하기</Button></AlertDialog.Action>
            </ResponsivePair>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Positioner></Portal>
    </AlertDialog.Root>
  </>
}

export default ShareComposer
