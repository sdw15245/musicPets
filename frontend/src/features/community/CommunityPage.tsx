import AppHeader from '../../shared/components/AppHeader'
import { IconArrowLeftLine } from '@karrotmarket/react-monochrome-icon'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { useSuccessNotice } from '../../shared/components/ui/useSuccessNotice'
import { RadioChipGroup, RadioChip, RadioChipLabel } from '../../shared/components/ui/RadioChip'
import Button from '../../shared/components/ui/Button'
import { AlertDialog, FloatingActionButton, Portal } from '@seed-design/react'
import { IconPlusLine } from '@karrotmarket/react-monochrome-icon'
import { ResultSection } from 'seed-design/ui/result-section'
import FeedSortMenu, { type FeedSort } from './FeedSortMenu'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useCurrentAnalysis } from '../analysis/useCurrentAnalysis'
import { useAuthStore } from '../auth/useAuthStore'
import { useProfile } from '../profile/useProfile'
import CommunityIcon from './CommunityIcon'
import { useFloatingComposer } from './useFloatingComposer'
import CommunitySearch from './CommunitySearch'
import PostCard from './PostCard'
import ShareComposer from './ShareComposer'
import { getPet, type CommunityTrack, type CommunityPost, type FeedView } from './model'
import { usePosts, usePostMutations } from './usePosts'
import { ShareDraftSchema } from './schemas'

type PetFilter = 'all' | 'same' | 'other'

interface ContentProps {
  profile: ReturnType<typeof useProfile>
  initialTrack?: CommunityTrack
}

function CommunityContent({ profile, initialTrack }: ContentProps) {
  const { signedIn } = profile
  const pet = getPet(profile.petSlug)
  const canFilter = signedIn && !!pet
  const analysis = useCurrentAnalysis()
  const composerTriggerRef = useRef<HTMLButtonElement>(null)
  const floatingTriggerRef = useRef<HTMLButtonElement>(null)
  const showFloatingComposer = useFloatingComposer(composerTriggerRef)
  const openedFromFloating = useRef(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPet = canFilter ? getPet(searchParams.get('pet')) : undefined
  const filterPet = requestedPet ?? pet
  const requestedFilter = searchParams.get('filter')
  const filter: PetFilter = canFilter && (requestedFilter === 'same' || requestedFilter === 'other')
    ? requestedFilter : canFilter && requestedPet && !requestedFilter ? 'same' : 'all'
  const sort: FeedSort = searchParams.get('sort') === 'popular' ? 'popular' : 'latest'
  const query = (searchParams.get('q') ?? '').trim().replace(/^#+/, '').trim().slice(0, 100)
  const [searchDraft, setSearchDraft] = useState({ query, value: query, pending: false })
  // Router transitions can commit after the next keystroke. Keep that draft until
  // our submitted query arrives; later history navigation can still reset it.
  if (searchDraft.pending && searchDraft.query === query) {
    setSearchDraft({ ...searchDraft, pending: false })
  }
  const searchInput = searchDraft.pending || searchDraft.query === query ? searchDraft.value : query
  const searchInputRef = useRef<HTMLInputElement>(null)
  const requestedView = searchParams.get('view')
  const view: FeedView = signedIn && requestedView === 'mine' ? 'mine' : 'discover'
  const [composer, setComposer] = useState<{ key: number, open: boolean, track?: CommunityTrack, post?: CommunityPost } | null>(initialTrack ? { key: 0, open: true, track: initialTrack } : null)
  const [loginOpen, setLoginOpen] = useState(false)
  const notifySuccess = useSuccessNotice()
  const navigate = useNavigate()
  const location = useLocation()

  const feed = usePosts(view, canFilter ? filter : 'all', requestedPet?.slug, sort, query)
  const posts = feed.data?.pages.flatMap(page => page.items) ?? []
  const { save, remove, like, pendingLikeIds, likePost } = usePostMutations()

  const updateSearch = (value: string) => {
    setSearchDraft({ query: value, value, pending: true })
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    })
  }

  const setFilter = (value: PetFilter) => setSearchParams(current => {
    const next = new URLSearchParams(current)
    if (value === 'all' && !requestedPet) next.delete('filter')
    else next.set('filter', value)
    return next
  })

  const setSort = (value: FeedSort) => setSearchParams(current => {
    const next = new URLSearchParams(current)
    if (value === 'latest') next.delete('sort')
    else next.set('sort', value)
    return next
  })

  const clearSearch = () => {
    updateSearch('')
    searchInputRef.current?.focus()
  }

  const openComposer = () => {
    if (!signedIn) { setLoginOpen(true); return }
    setComposer(current => ({ key: (current?.key ?? 0) + 1, open: true }))
  }

  const restoreComposerFocus = () => {
    const floating = floatingTriggerRef.current
    const trigger = openedFromFloating.current && floating?.getClientRects().length ? floating : composerTriggerRef.current
    trigger?.focus()
    openedFromFloating.current = false
  }

  const closeComposer = () => {
    // Keep the controlled root mounted so SEED can finish exit and restore focus.
    setComposer(current => current && { ...current, open: false })
    // 전달받은 초안은 소비한 뒤 지워 뒤로 가기로 작성창이 다시 열리지 않게 한다.
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }

  const publish = async (track: CommunityTrack, caption: string, tags: string[]) => {
    if (!signedIn) { setLoginOpen(true); return }
    await save.mutateAsync({ id: composer?.post?.id, trackUri: track.uri, caption, tags })
    closeComposer()
    if (!composer?.post) {
      navigate('/community', { replace: true, state: null })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    if (composer?.post) setFilter('all')
    notifySuccess(composer?.post ? '글을 수정했어요.' : '오늘의 한 곡을 공유했어요.')
  }

  const deletePost = async (id: string) => {
    if (remove.isPending) return
    await remove.mutateAsync(id)
    notifySuccess('공유한 글을 삭제했어요.')
    composerTriggerRef.current?.focus()
  }

  return (
    <div className="community-page">
      <AppHeader />

      <div className="community-layout">
        <aside className="community-sidebar" aria-label="음악 취향 안내">
          <section className="community-petcard">{pet ? <><div className="community-petportrait" style={{ backgroundColor: pet.color }}><img src={pet.imageUrl} alt={pet.name} /></div><span className="community-petcontext">나의 음악 펫</span><h2>{pet.name}</h2></> : <><div className="community-unmatched">{signedIn ? <CommunityIcon name="sparkles" /> : 'GUEST'}</div><h2>내 음악 펫은?</h2><p>분석을 통해 나와 닮은<br />음악 취향을 만나보세요.</p></>}
            <Link to={analysis ? '/result' : '/analyze'} className="community-petlink">{analysis ? '내 취향 보기' : '내 음악 취향 분석하기'}<CommunityIcon name="arrow" /></Link>
          </section>
        </aside>

        <main className="community-feed">
          {view !== 'discover' && <Link className="community-return-link" to="/mypage"><IconArrowLeftLine size={16} aria-hidden="true" /> 내 프로필</Link>}
          <div className="community-feedheading"><div><h1>{view === 'mine' ? '내 글' : '오늘, 어떤 음악 들었어요?'}</h1></div>
            <Button ref={composerTriggerRef} variant="brandSolid" onClick={() => { openedFromFloating.current = false; openComposer() }} aria-label="오늘의 한 곡 올리기" aria-haspopup="dialog" aria-expanded={composer?.open ?? false}>한 곡 올리기</Button>
          </div>
          <div className="community-filterbar"><RadioChipGroup className="seed-feed-filters" aria-label="취향 필터" value={filter} onValueChange={(value) => setFilter(value as PetFilter)}>
            <RadioChip value="all"><RadioChipLabel>전체 음악</RadioChipLabel></RadioChip>
            <RadioChip value="same" disabled={!canFilter}><RadioChipLabel>{requestedPet ? `${requestedPet.name}의 음악` : '나와 같은 펫'}</RadioChipLabel></RadioChip>
            <RadioChip value="other" disabled={!canFilter}><RadioChipLabel>다른 펫</RadioChipLabel></RadioChip>
          </RadioChipGroup>
            <FeedSortMenu value={sort} onChange={setSort} />
              <CommunitySearch owner={signedIn ? profile.owner : null} inputRef={searchInputRef} value={searchInput} onSearch={updateSearch} onValueChange={value => {
                  setSearchDraft(current => current.pending ? { ...current, value } : { query, value, pending: false })
                  if (!value.trim() && query) updateSearch('')
                }} />

          </div>
          {query && <div className="community-search-summary" role="status"><span>‘{query}’ 검색 결과</span><Button size="small" variant="ghost" onClick={clearSearch}>검색 초기화</Button></div>}
          {!canFilter && <p className="community-filterhint">{signedIn ? '음악 취향을 분석하면 펫별로 음악을 둘러볼 수 있어요.' : '로그인하면 글·댓글을 작성할 수 있어요. 취향 필터는 분석 후 이용할 수 있어요.'}</p>}
          {filter !== 'all' && filterPet && <p className="community-filterhint">{filter === 'same' ? `${filterPet.name}와 같은 펫을 가진 사람들의 음악이에요.` : `${filterPet.name}와 다른 펫의 음악을 만나보세요.`}</p>}
          {feed.isPending && <MusicListSkeleton label="음악을 불러오고 있어요." />}
          {feed.isError && <RequestErrorNotice error={feed.error} action={blocked => <Button loading={feed.isFetching} disabled={feed.isFetching || blocked} onClick={() => void feed.refetch()}>다시 불러오기</Button>}>글 목록을 불러오지 못했어요.</RequestErrorNotice>}
          {like.isError && <RequestErrorNotice error={like.error}>공감을 변경하지 못했어요. 잠시 후 공감 버튼을 다시 눌러주세요.</RequestErrorNotice>}
          <div className="community-posts">
            {posts.map((post) => <PostCard key={post.id} post={post} liked={signedIn && post.liked}
              onRequireLogin={() => setLoginOpen(true)}
              liking={pendingLikeIds.has(post.id)}
              onLike={() => { if (!signedIn) { setLoginOpen(true); return } return likePost({ id: post.id, liked: !post.liked }) }}
              onEdit={() => { if (post.own) setComposer(current => ({ key: (current?.key ?? 0) + 1, open: true, post })) }}
              deleting={remove.isPending && remove.variables === post.id}
              onDelete={() => deletePost(post.id)} />)}
            {!feed.isPending && !feed.isError && !posts.length && <ResultSection
              size="medium"
              asset={<CommunityIcon name={query ? 'search' : 'music'} />}
              title={query ? '검색 결과가 없어요' : filter !== 'all' ? '이 취향의 공유곡이 아직 없어요' : view === 'mine' ? '아직 공유한 음악이 없어요' : '첫 번째 음악을 들려주세요'}
              description={query ? '다른 단어로 검색하거나 검색어를 지워보세요.' : filter !== 'all' ? '다른 취향의 음악도 둘러보세요.' : '좋아하는 곡과 짧은 이야기를 남겨보세요.'}
              actions={<Button onClick={query ? clearSearch : filter !== 'all' ? () => setFilter('all') : openComposer}>{query ? '검색어 지우기' : filter !== 'all' ? '전체 음악 둘러보기' : signedIn ? '한 곡 올리기' : '로그인하고 한 곡 올리기'}</Button>} />}
          </div>
          {feed.hasNextPage && <Button loading={feed.isFetchingNextPage} disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>음악 더 보기</Button>}
        </main>

      </div>
      <div className="community-compose-fab" hidden={!showFloatingComposer}>
        <FloatingActionButton.Root ref={floatingTriggerRef} extended aria-label="빠르게 한 곡 올리기"
          aria-haspopup="dialog" aria-expanded={composer?.open || loginOpen || false}
          onClick={() => { openedFromFloating.current = true; openComposer() }}>
          <FloatingActionButton.Icon svg={<IconPlusLine />} /><FloatingActionButton.Label>한 곡 올리기</FloatingActionButton.Label>
        </FloatingActionButton.Root>
      </div>
      {composer && <ShareComposer key={composer.key} open={composer.open} initialPost={composer.post} initialTrack={composer.track} authorName={profile.name} pet={getPet(profile.avatarSlug)} onClose={closeComposer} onPublish={publish} onExitComplete={restoreComposerFocus} />}
      <AlertDialog.Root open={loginOpen} onOpenChange={setLoginOpen}>
        <Portal><AlertDialog.Positioner><AlertDialog.Backdrop /><AlertDialog.Content>
          <AlertDialog.Header><AlertDialog.Title>로그인하고 함께해요</AlertDialog.Title><AlertDialog.Description>음악은 누구나 들을 수 있어요. 글·댓글 작성과 공감은 로그인 후 이용할 수 있어요.</AlertDialog.Description></AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Action asChild><Button>계속 둘러보기</Button></AlertDialog.Action>
            <Button asChild variant="brandSolid"><Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Spotify 연결하기</Link></Button>
          </AlertDialog.Footer>
        </AlertDialog.Content></AlertDialog.Positioner></Portal>
      </AlertDialog.Root>
    </div>
  )
}

function CommunityPage() {
  const profile = useProfile()
  const sessionId = useAuthStore((state) => state.sessionId)
  const location = useLocation()
  const parsed = ShareDraftSchema.safeParse(location.state)
  const draft = profile.signedIn && parsed.success && parsed.data.sourceSessionId === sessionId ? parsed.data : undefined

  return <CommunityContent key={profile.owner} profile={profile} initialTrack={draft?.shareTrack} />
}

export default CommunityPage
