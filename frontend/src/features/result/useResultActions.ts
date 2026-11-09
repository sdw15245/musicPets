import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { AnalysisSchema, SavePlaylistSchema } from '../analysis/schemas'
import { acceptAnalysisResult, analysisDetailQuery, type AnalysisDetail } from '../analysis/analysisQuery'
import { useAuthStore } from '../auth/useAuthStore'

export function useAnalysisDetail(id: string, section: AnalysisDetail) {
  const sessionId = useAuthStore(s => s.sessionId)
  return useQuery(analysisDetailQuery(sessionId, id, section))
}

export function useRetryRecommendations() {
  const sessionId = useAuthStore((s) => s.sessionId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { data } = await api.post('/api/analysis/' + encodeURIComponent(id) + '/recommendations', undefined, { timeout: 180_000 })
        return AnalysisSchema.parse(data)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: data => acceptAnalysisResult(queryClient, sessionId, data),
  })
}

export function useSavePlaylist() {
  return useMutation({
    mutationFn: async (uris: string[]) => {
      try {
        const { data } = await api.post('/api/analysis/recommendations/save', { uris })
        return SavePlaylistSchema.parse(data)
      } catch (e) {
        throw normalizeError(e)
      }
    },
  })
}
