import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../auth/useAuthStore'
import { latestAnalysisQuery } from './analysisQuery'

/** 저장된 최신 결과만 조회한다. 외부 분석 API는 실행하지 않는다. */
export function useCurrentAnalysisState() {
  const sessionId = useAuthStore(s => s.sessionId)
  const signedIn = useAuthStore(s => !!s.accessToken)
  const status = useAuthStore(s => s.status)
  const query = useQuery({ ...latestAnalysisQuery(sessionId), enabled: signedIn })
  return {
    analysis: signedIn ? query.data : undefined,
    pending: status === 'loading' || (signedIn && query.isPending),
    failed: signedIn && query.isError && query.data === undefined,
  }
}

export function useCurrentAnalysis() {
  return useCurrentAnalysisState().analysis
}
