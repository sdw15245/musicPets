import { useSuspenseQuery } from '@tanstack/react-query'
import { useAuthStore } from '../auth/useAuthStore'
import { analysisQuery } from './analysisQuery'

export function useAnalysis() {
  const sessionId = useAuthStore((s) => s.sessionId)
  return useSuspenseQuery(analysisQuery(sessionId))
}
