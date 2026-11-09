import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { queryKeys } from '../../shared/api/queryKeys'
import { AnalysisSchema } from '../analysis/schemas'
import { latestAnalysisQuery } from '../analysis/analysisQuery'
import { useAuthStore } from '../auth/useAuthStore'

export function useHistory() {
  const sessionId = useAuthStore(s => s.sessionId)
  return useQuery({
    queryKey: ['analysis-history', sessionId], retry: false,
    queryFn: async ({ signal }) => {
      try { return z.array(AnalysisSchema).parse((await api.get('/api/analysis/history', { signal })).data) }
      catch (error) { throw normalizeError(error) }
    },
  })
}
export function useHistoricalAnalysis(id: string) {
  const sessionId = useAuthStore(s => s.sessionId)
  return useQuery({
    queryKey: ['analysis-history', sessionId, id], retry: false,
    queryFn: async ({ signal }) => {
      try { return AnalysisSchema.parse((await api.get('/api/analysis/history/' + encodeURIComponent(id), { signal })).data) }
      catch (error) { throw normalizeError(error) }
    },
  })
}
export function useDeleteHistory() {
  const sessionId = useAuthStore(s => s.sessionId)
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try { await api.delete('/api/analysis/history/' + encodeURIComponent(id)) }
      catch (error) { throw normalizeError(error) }
    },
    onSuccess: async () => {
      client.removeQueries({ queryKey: queryKeys.analysis.run(sessionId) })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['analysis-history', sessionId] }),
        client.invalidateQueries({ queryKey: latestAnalysisQuery(sessionId).queryKey, exact: true }),
      ])
    },
  })
}
