import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { queryKeys } from '../../shared/api/queryKeys'
import { AnalysisSchema, type AnalysisResult } from './schemas'
import { useAuthStore } from '../auth/useAuthStore'
import { SessionChangedError } from '../auth/session'

const MIN_ANALYSIS_REVEAL_MS = 2500

// 분석은 명시적으로 시작/재시도할 때만 실행한다. 화면 이동·탭 포커스로 재실행하지 않는다.
export function analysisQuery(sessionId: string) {
  return queryOptions({
    queryKey: queryKeys.analysis.run(sessionId),
    queryFn: async ({ client }) => {
      const startedAt = performance.now()
      try {
        const { data } = await api.post('/api/analysis', undefined, {
          timeout: 180_000, headers: { 'X-Analysis-Mode': 'progressive' },
        })
        const result = AnalysisSchema.parse(data)
        // 결과를 먼저 저장하고 최소 공개 대기 중에도 상세 요청은 진행한다.
        await client.cancelQueries({ queryKey: latestAnalysisQuery(sessionId).queryKey, exact: true })
        if (useAuthStore.getState().sessionId !== sessionId) throw new SessionChangedError()
        client.setQueryData(latestAnalysisQuery(sessionId).queryKey, result)
        void client.invalidateQueries({ queryKey: ['analysis-history', sessionId] })
        if (result.profilePending) void client.prefetchQuery(analysisDetailQuery(sessionId, result.id, 'profile'))
        if (result.recommendationsPending) void client.prefetchQuery(analysisDetailQuery(sessionId, result.id, 'recommendations'))
        const remaining = MIN_ANALYSIS_REVEAL_MS - (performance.now() - startedAt)
        if (remaining > 0) await new Promise<void>(resolve => window.setTimeout(resolve, remaining))
        if (useAuthStore.getState().sessionId !== sessionId) throw new SessionChangedError()
        return result
      } catch (e) {
        throw normalizeError(e)
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// 응답 순서가 뒤바뀌어도 이미 채워진 카드를 되돌리지 않는다.
export function acceptAnalysisResult(client: QueryClient, sessionId: string, result: AnalysisResult) {
  void client.invalidateQueries({ queryKey: ['analysis-history', sessionId] })
  client.setQueryData<AnalysisResult | null>(latestAnalysisQuery(sessionId).queryKey, previous => {
    if (previous?.id !== result.id || (!previous.profilePending && result.profilePending)
      || (!previous.recommendationsPending && result.recommendationsPending)) return previous
    return result
  })
}

export type AnalysisDetail = 'profile' | 'recommendations'

export function analysisDetailQuery(sessionId: string, id: string, section: AnalysisDetail) {
  return queryOptions({
    queryKey: ['analysis-detail', sessionId, id, section],
    queryFn: async ({ client }) => {
      try {
        const path = section === 'profile' ? 'profile' : 'recommendations/initial'
        const { data } = await api.post(`/api/analysis/${encodeURIComponent(id)}/${path}`, undefined, { timeout: 60_000 })
        const result = AnalysisSchema.parse(data)
        acceptAnalysisResult(client, sessionId, result)
        return result
      } catch (error) { throw normalizeError(error) }
    },
    staleTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// 저장된 결과 조회와 분석 실행의 키를 분리해 화면 표시만으로 재분석하지 않는다.
export function latestAnalysisQuery(sessionId: string) {
  return queryOptions({
    queryKey: queryKeys.analysis.result(sessionId),
    queryFn: async ({ signal }) => {
      try {
        const response = await api.get('/api/analysis/latest', { signal, timeout: 15_000 })
        return response.status === 204 ? null : AnalysisSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
