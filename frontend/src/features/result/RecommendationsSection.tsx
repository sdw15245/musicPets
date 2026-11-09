import Button from '../../shared/components/ui/Button'
import { ApiError, isSpotifyReauthorizationRequired } from '../../shared/api/error'
import type { AnalysisResult } from '../analysis/schemas'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import type { RequestLimitState } from '../../shared/api/useRequestLimit'
import type { useRetryRecommendations, useSavePlaylist } from './useResultActions'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import AnalysisDetailStatus from './AnalysisDetailStatus'
import ArtistRecommendations from './ArtistRecommendations'
import LegacyRecommendationsSection from './LegacyRecommendationsSection'

interface Props {
  data: AnalysisResult
  retry: ReturnType<typeof useRetryRecommendations>
  save: ReturnType<typeof useSavePlaylist>
  limit: RequestLimitState | null
  onRestart: () => void
}

export default function RecommendationsSection(props: Props) {
  const { data, retry, limit, onRestart } = props
  if (data.recommendedArtists == null) return <LegacyRecommendationsSection {...props} />
  const reconnect = isSpotifyReauthorizationRequired(retry.error)
  const expired = retry.error instanceof ApiError && retry.error.status === 409
  return <section className="test-card result-recommendations" aria-labelledby="recommended-artists-title">
    <h2 className="wf-h3" id="recommended-artists-title">이 아티스트도 들어보세요</h2>
    {reconnect ? <SpotifyReconnectNotice /> : <>
      {limit && <RequestLimitNotice limit={limit} />}
      {data.recommendationsPending ? <AnalysisDetailStatus id={data.id} section="recommendations" artists /> :
        data.recommendedArtists.length > 0 ? <ArtistRecommendations artists={data.recommendedArtists} /> :
        <div className="reco-empty">
          {!limit && <p className="reco-empty-title">{expired ? '새로 분석하면 아티스트를 다시 찾을 수 있어요.' : data.recommendationsAvailable ? '아직 추천할 아티스트를 찾지 못했어요.' : '추천 아티스트를 불러오지 못했어요.'}</p>}
          {expired ? <Button variant="neutralWeak" onClick={onRestart}>음악 취향 새로 분석하기</Button> :
            <Button variant="neutralWeak" size="medium" loading={retry.isPending} disabled={retry.isPending || limit?.blocked} onClick={() => retry.mutate(data.id)}>아티스트 다시 찾기</Button>}
          {retry.isError && !expired && !limit && <ErrorNotice>잠시 후 다시 시도해주세요.</ErrorNotice>}
        </div>}
    </>}
  </section>
}
