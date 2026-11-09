import { Link } from 'react-router-dom'
import Button from '../../shared/components/ui/Button'
import { spotifyUrl } from '../../shared/spotify'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import { ApiError, isSpotifyReauthorizationRequired } from '../../shared/api/error'
import type { AnalysisResult } from '../analysis/schemas'
import { useAuthStore } from '../auth/useAuthStore'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import type { RequestLimitState } from '../../shared/api/useRequestLimit'
import type { useRetryRecommendations, useSavePlaylist } from './useResultActions'
import { IconArrowRightLine, IconArrowUpRightLine } from '@karrotmarket/react-monochrome-icon'
import TrackArtwork from '../community/TrackArtwork'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import AnalysisDetailStatus from './AnalysisDetailStatus'

interface Props {
  data: AnalysisResult
  retry: ReturnType<typeof useRetryRecommendations>
  save: ReturnType<typeof useSavePlaylist>
  limit: RequestLimitState | null
  onRestart: () => void
}

export default function LegacyRecommendationsSection(props: Props) {
  const needsReconnect = isSpotifyReauthorizationRequired(props.retry.error)
    || isSpotifyReauthorizationRequired(props.save.error)

  return <section className="test-card result-recommendations">
    <h2 className="wf-h3">다음에 들을 음악</h2>
    {props.limit && !needsReconnect && <RequestLimitNotice limit={props.limit} />}
    {needsReconnect ? <SpotifyReconnectNotice /> : <RecommendationsContent {...props} />}
  </section>
}

function RecommendationsContent({ data, retry, save, limit, onRestart }: Props) {
  const sessionId = useAuthStore((state) => state.sessionId)

  if (data.recommendationsPending) return <AnalysisDetailStatus id={data.id} section="recommendations" />

  if (retry.error instanceof ApiError && retry.error.status === 409) return <div className="reco-actions">
    <p className="wf-sub">이 분석의 추천곡을 다시 찾을 수 있는 시간이 지났어요.</p>
    <Button variant="neutralWeak" onClick={onRestart}>음악 취향 새로 분석하기</Button>
  </div>

  if (!data.recommendationsAvailable || data.recommendations.length === 0) return <div className="reco-empty">
    {!limit && <p className="reco-empty-title">{data.recommendationsAvailable ? '이번 분석에서는 추천할 곡을 찾지 못했어요.' : '추천곡을 가져오지 못했어요.'}</p>}
    <Button variant="neutralWeak" size="medium" loading={retry.isPending} disabled={retry.isPending || limit?.blocked} onClick={() => retry.mutate(data.id)}>
      {retry.isPending ? '추천곡을 찾는 중…' : '추천곡 다시 시도'}
    </Button>
    {retry.isError && !limit && <ErrorNotice>추천곡을 가져오지 못했어요. 연결 상태를 확인하고 잠시 후 다시 시도해주세요.</ErrorNotice>}
  </div>

  return <>
    <ul className="reco-list">
      {data.recommendations.map((track) => <li key={track.uri} className="reco-row reco-row-share">
        <TrackArtwork track={track} className="reco-img" />
        <div className="reco-meta">
          <p className="reco-name">{track.name}</p><p className="reco-artist">{track.artist}</p>
          <a className="reco-listen" href={spotifyUrl(track)} target="_blank" rel="noreferrer" aria-label={`${track.name} Spotify에서 듣기`}>Spotify에서 듣기 <IconArrowUpRightLine className="inline-icon" aria-hidden="true" /><SpotifyLogo /></a>
        </div>
        <div className="reco-track-actions">
        <Button asChild size="small" variant="ghost">
          <Link className="result-share-action" to="/community" aria-label={`${track.name} 이 곡으로 글 쓰기`}
            state={{ shareTrack: track, petSlug: data.character?.slug ?? null, sourceSessionId: sessionId }}>이 곡으로 글 쓰기 <IconArrowRightLine size={16} aria-hidden="true" /></Link>
        </Button></div>
      </li>)}
    </ul>
    <div className="reco-actions">
      <p className="wf-sub">추천곡을 새 Spotify 플레이리스트로 저장해요.</p>
      {save.data ? (
        <Button asChild variant="neutralWeak" size="medium"><a href={save.data.playlistUrl} target="_blank" rel="noreferrer">플레이리스트 열기 <IconArrowUpRightLine size={20} aria-hidden="true" /></a></Button>
      ) : (
        <Button variant="neutralWeak" size="medium" loading={save.isPending} disabled={save.isPending || limit?.blocked}
          onClick={() => save.mutate(data.recommendations.map((track) => track.uri))}>
          {save.isPending ? '저장 중…' : 'Spotify에 저장'}
        </Button>
      )}
      {save.isError && !limit && <ErrorNotice>저장하지 못했어요. 다시 시도하거나 Spotify에 다시 연결해 플레이리스트 권한을 확인해주세요.</ErrorNotice>}
    </div>
  </>
}
