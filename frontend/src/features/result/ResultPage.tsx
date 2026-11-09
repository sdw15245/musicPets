import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ResultSection } from 'seed-design/ui/result-section'
import ResultLayout from './ResultLayout'
import ResultSkeleton from './ResultSkeleton'
import Button from '../../shared/components/ui/Button'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { analysisQuery, latestAnalysisQuery } from '../analysis/analysisQuery'
import type { AnalysisResult } from '../analysis/schemas'
import { useAuthStore } from '../auth/useAuthStore'
import GenreExplorer from './GenreExplorer'
import RecommendationsSection from './RecommendationsSection'
import { useRetryRecommendations, useSavePlaylist } from './useResultActions'
import { useRequestLimit } from '../../shared/api/useRequestLimit'
import ResultShareDialog from './ResultShareDialog'
import AnalysisOverview from './AnalysisOverview'
import PopularitySummary from './PopularitySummary'
import { analysisDate } from '../history/historyFormat'
import CommunityBridge from '../community/CommunityBridge'
import { isPopularityNotice } from './analysisNotices'

function ResultContent({ data, onRestart }: { data: AnalysisResult; onRestart: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [reveal] = useState(() => location.state?.revealAnalysisId === data.id)
  useEffect(() => {
    // Consume the arrival marker, so refresh and back navigation do not replay it.
    if (location.state?.revealAnalysisId) navigate(location.pathname + location.search + location.hash, { replace: true, state: null })
  }, [location, navigate])
  const retry = useRetryRecommendations()
  const save = useSavePlaylist()
  const limit = useRequestLimit([retry.error, save.error], data.recommendationLimit)
  const notices = data.warnings.filter(warning => !isPopularityNotice(warning))
  return <>
    <div className="result-toolbar"><time dateTime={data.analyzedAt}>{analysisDate(data.analyzedAt)} 분석</time><Button variant="ghost" size="small" disabled={limit?.blocked} onClick={onRestart}>다시 분석하기</Button></div>
    <AnalysisOverview data={data} reveal={reveal} actions={<><ResultShareDialog data={data} /><CommunityBridge petSlug={data.character?.slug} petName={data.character?.name} /></>} />
    {notices.length > 0 && <aside className="analysis-notices" aria-label="분석 안내">{notices.map(warning => <p key={warning}>{warning}</p>)}</aside>}
    <div className="result-details-grid">
      <RecommendationsSection data={data} retry={retry} save={save} limit={limit} onRestart={onRestart} />
      <div className="result-listening-details">
        <GenreExplorer vector={data.genres.vector} trackCount={data.genres.trackCount} animate={reveal} />
        <PopularitySummary data={data} />
      </div>
    </div>
  </>
}

export default function ResultPage() {
  const sessionId = useAuthStore(state => state.sessionId)
  const client = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery(latestAnalysisQuery(sessionId))
  return <ResultLayout>
    {query.isPending ? <ResultSkeleton /> : query.isError ? <RequestErrorNotice error={query.error} action={blocked => <Button disabled={blocked} onClick={() => void query.refetch()}>다시 불러오기</Button>}>저장된 결과를 불러오지 못했어요.</RequestErrorNotice> : query.data ?
      <ResultContent key={query.data.id} data={query.data} onRestart={() => { client.removeQueries({ queryKey: analysisQuery(sessionId).queryKey, exact: true }); navigate('/analyze', { replace: true }) }} /> :
      <ResultSection size="medium" title="아직 분석한 취향이 없어요" description="Spotify 청취 기록으로 나를 닮은 펫과 추천 아티스트를 찾아보세요." actions={<Button asChild variant="brandSolid"><Link to="/analyze">음악 취향 분석하기</Link></Button>} />}
  </ResultLayout>
}
