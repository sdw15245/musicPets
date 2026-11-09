import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field, ScaleFeedback, TextField } from '@seed-design/react'
import { z } from 'zod'
import { api } from '../../shared/api/client'
import { normalizeError, isSpotifyReauthorizationRequired } from '../../shared/api/error'
import { useAuthStore } from '../auth/useAuthStore'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import { useRequestLimit } from '../../shared/api/useRequestLimit'
import Button from '../../shared/components/ui/Button'
import { CommunityTrackSchema, type CommunityTrack } from './schemas'
import TrackArtwork from './TrackArtwork'
import CommunityIcon from './CommunityIcon'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import LoadingStatus from '../../shared/components/ui/LoadingStatus'

export default function TrackSearch({ onSelect }: { onSelect: (track: CommunityTrack) => void }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)
  const [requestBlock, setRequestBlock] = useState<unknown>(null)
  const sessionId = useAuthStore(s => s.sessionId)
  const search = useQuery({
    queryKey: ['track-search', sessionId, query], enabled: !!query,
    queryFn: async ({ signal }) => {
      try {
        const response = await api.get('/api/tracks/search', { params: { q: query }, signal })
        const tracks = z.array(CommunityTrackSchema).parse(response.data)
        if (!signal.aborted) setRequestBlock(null)
        return tracks
      } catch (error) {
        const failure = normalizeError(error)
        if (!signal.aborted && (failure.status === 429 || isSpotifyReauthorizationRequired(failure))) setRequestBlock(failure)
        throw failure
      }
    },
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const limit = useRequestLimit([requestBlock, search.error])
  const reconnect = isSpotifyReauthorizationRequired(requestBlock) || isSpotifyReauthorizationRequired(search.error)
  const pauseAutomaticSearch = !!requestBlock || !!limit || reconnect
  const trimmed = input.trim()
  const current = !!trimmed && query === trimmed && !composing
  const waiting = !!trimmed && !current && !pauseAutomaticSearch
  useEffect(() => {
    if (!trimmed || composing || pauseAutomaticSearch || trimmed === query) return
    const timer = window.setTimeout(() => setQuery(trimmed), 500)
    return () => window.clearTimeout(timer)
  }, [trimmed, composing, pauseAutomaticSearch, query])
  const submit = () => {
    if (!trimmed || composing || (current && search.isFetching) || limit?.blocked || reconnect) return
    if (trimmed === query) void search.refetch()
    else setQuery(trimmed)
  }
  return <>
    <Field.Root>
      <Field.Header><Field.Label>곡 검색</Field.Label></Field.Header>
      <TextField.Root value={input} onValueChange={value => { setInput(value); if (!value.trim()) setQuery('') }}>
        <TextField.PrefixIcon svg={<CommunityIcon name="search" />} />
        <TextField.Input placeholder="곡명 또는 아티스트" autoComplete="off" maxLength={100}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onKeyDown={event => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (!event.nativeEvent.isComposing && event.keyCode !== 229) submit()
        }} />
      </TextField.Root>
      <Field.Footer><Field.Description>제목이나 아티스트를 입력하면 아래에 검색 결과가 나와요.</Field.Description></Field.Footer>
    </Field.Root>
    <Button type="button" size="small" loading={current && search.isFetching} disabled={!trimmed || composing || (current && search.isFetching) || limit?.blocked || reconnect} onClick={submit}>검색</Button>
    {limit ? <RequestLimitNotice limit={limit} /> : reconnect
      ? <SpotifyReconnectNotice /> : current && search.isError && <ErrorNotice>곡을 검색하지 못했어요. 다시 검색해 주세요.</ErrorNotice>}
    <div className="share-options" aria-busy={waiting || (current && search.isFetching)}>
      {waiting ? <p role="status">입력을 마치면 검색해요.</p> : current && search.isFetching ? <LoadingStatus>Spotify에서 검색하고 있어요.</LoadingStatus> : current && search.data?.map(item =>
        <ScaleFeedback key={item.uri}>
          <button type="button" aria-label={`${item.name} — ${item.artist}`} onClick={() => onSelect(item)}>
            <TrackArtwork track={item} /><span><strong>{item.name}</strong><small>{item.artist}</small></span><CommunityIcon name="plus" />
          </button>
        </ScaleFeedback>)}
      {current && search.isSuccess && !search.isFetching && !search.data.length && <p role="status">검색 결과가 없어요. 다른 제목이나 아티스트로 찾아보세요.</p>}
    </div>
  </>
}
