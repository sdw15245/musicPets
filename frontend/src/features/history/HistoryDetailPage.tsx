import { Link, useParams } from 'react-router-dom'
import { ResultSection } from 'seed-design/ui/result-section'
import PersonalLayout from '../mypage/PersonalLayout'
import Button from '../../shared/components/ui/Button'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { ApiError } from '../../shared/api/error'
import GenreExplorer from '../result/GenreExplorer'
import AnalysisOverview from '../result/AnalysisOverview'
import ResultShareDialog from '../result/ResultShareDialog'
import CommunityBridge from '../community/CommunityBridge'
import PopularitySummary from '../result/PopularitySummary'
import TrackArtwork from '../community/TrackArtwork'
import { spotifyUrl } from '../../shared/spotify'
import { useHistoricalAnalysis } from './useHistory'
import { analysisDate } from './historyFormat'
import { isPopularityNotice } from '../result/analysisNotices'
import ArtistRecommendations from '../result/ArtistRecommendations'

export default function HistoryDetailPage() {
  const { id = '' } = useParams()
  const query = useHistoricalAnalysis(id)
  const result = query.data
  const notices = result?.warnings.filter(warning => !isPopularityNotice(warning)) ?? []
  const missing = query.error instanceof ApiError && query.error.status === 404
  return <PersonalLayout taste title="지난 분석 결과" description={result ? analysisDate(result.analyzedAt) + '에 기록한 취향이에요.' : '그날의 음악 취향을 다시 만나보세요.'}>
    <Button asChild size="small" variant="ghost"><Link to="/history">분석 기록 목록</Link></Button>
    {query.isPending && <MusicListSkeleton label="분석 결과를 불러오고 있어요." />}
    {missing ? <ResultSection size="medium" title="기록을 찾을 수 없어요" description="삭제되었거나 보관 기간이 지난 기록일 수 있어요." /> :
      query.isError && <RequestErrorNotice error={query.error} action={blocked => <Button disabled={blocked} onClick={() => void query.refetch()}>다시 불러오기</Button>}>분석 결과를 불러오지 못했어요.</RequestErrorNotice>}
    {result && <div className="personal-detail">
      <AnalysisOverview data={result} historical actions={<><ResultShareDialog data={result} /><CommunityBridge petSlug={result.character?.slug} petName={result.character?.name} /></>} />
      {!!notices.length && <aside className="analysis-notices" aria-label="분석 안내">{notices.map(warning => <p key={warning}>{warning}</p>)}</aside>}
      {result.recommendedArtists != null ? <section aria-labelledby="history-artists"><h2 id="history-artists">그날의 추천 아티스트</h2>
        <ArtistRecommendations artists={result.recommendedArtists} />
        {!result.recommendedArtists.length && <p>{result.recommendationsPending ? '아티스트를 찾는 중에 저장된 기록이에요.' : '이 기록에는 추천 아티스트가 없어요.'}</p>}
      </section> : <section aria-labelledby="history-songs"><h2 id="history-songs">그날의 추천곡</h2>
        <ul className="personal-list">{result.recommendations.map(track => <li className="personal-card" key={track.uri}>
          <a className="history-track-link" href={spotifyUrl(track)} target="_blank" rel="noreferrer"><TrackArtwork track={track} /><div><h3>{track.name}</h3><p>{track.artist} · Spotify에서 듣기</p></div></a>
        </li>)}</ul>
        {!result.recommendations.length && <p>{result.recommendationsPending ? '추천곡을 찾는 중에 저장된 기록이에요.' : '이 기록에는 저장된 추천곡이 없어요.'}</p>}
      </section>}
      <GenreExplorer vector={result.genres.vector} trackCount={result.genres.trackCount} />
      <PopularitySummary data={result} />
    </div>}
  </PersonalLayout>
}
