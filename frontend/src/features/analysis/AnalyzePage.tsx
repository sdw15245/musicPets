import Button from '../../shared/components/ui/Button'
import { ResultSection } from 'seed-design/ui/result-section'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../auth/useAuthStore'
import { queryKeys } from '../../shared/api/queryKeys'
import AsyncBoundary from '../../shared/components/AsyncBoundary'
import { MatchSplash } from './MatchSplash'
import { useAnalysis } from './useAnalysis'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import { isSpotifyReauthorizationRequired } from '../../shared/api/error'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import { useRequestLimit } from '../../shared/api/useRequestLimit'

function AnalysisFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const limit = useRequestLimit([error])
  if (limit) return (
    <section className="state-card">
      <RequestLimitNotice limit={limit} />
      <div className="reco-actions" style={{ marginTop: 16 }}>
        <Button variant="brandSolid" disabled={limit.blocked} onClick={retry}>다시 분석하기</Button>
        <Button asChild variant="neutralWeak"><Link  to="/">홈으로</Link></Button>
      </div>
    </section>
  )
  return isSpotifyReauthorizationRequired(error) ? (
    <section className="state-card">
      <SpotifyReconnectNotice />
      <Button asChild variant="neutralWeak"><Link  to="/" style={{ marginTop: 16 }}>홈으로</Link></Button>
    </section>
  ) : (
    <section className="state-card" role="alert">
      <ResultSection headingLevel={1} title="음악 취향을 분석하지 못했어요"
        description="음악 데이터를 가져오는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요."
        actions={<><Button onClick={retry}>다시 분석하기</Button><Button asChild variant="ghost"><Link to="/">홈으로</Link></Button></>} />
    </section>
  )
}

function AnalysisReady() {
  const { data } = useAnalysis()
  const sessionId = useAuthStore(s => s.sessionId)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  useEffect(() => {
    if (useAuthStore.getState().sessionId !== sessionId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me(sessionId) })
    navigate('/result', { replace: true, state: { revealAnalysisId: data.id } })
  }, [sessionId, queryClient, navigate, data.id])
  return <MatchSplash />
}

function AnalyzePage() {
  return (
    <main className="auth-page">
      <AsyncBoundary
        loadingFallback={<MatchSplash />}
        errorFallback={({ error, resetErrorBoundary }) => <AnalysisFailure error={error} retry={resetErrorBoundary} />}
      >
        <AnalysisReady />
      </AsyncBoundary>
    </main>
  )
}

export default AnalyzePage
