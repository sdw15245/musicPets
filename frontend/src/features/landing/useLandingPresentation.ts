import { useEffect } from 'react'
import { useAuthStore, useUserId } from '../auth/useAuthStore'
import { useCurrentAnalysisState } from '../analysis/useCurrentAnalysis'
import { freshView, saveLandingView, useLandingView } from './landingView'

export function useLandingPresentation() {
  const { analysis, pending, failed: resultFailed } = useCurrentAnalysisState()
  const status = useAuthStore(state => state.status)
  const signedIn = useAuthStore(state => !!state.accessToken)
  const userId = useUserId()
  const previous = freshView(useLandingView(state => state.view))
  const failed = resultFailed || status === 'error'

  useEffect(() => {
    if (pending || failed) return
    const savedAt = Date.now()
    if (!signedIn) saveLandingView({ kind: 'guest', userId: null, savedAt })
    else if (userId && analysis !== undefined) saveLandingView({ kind: analysis ? 'result' : 'empty', userId, savedAt })
  }, [analysis, pending, failed, signedIn, userId])

  const matching = previous?.userId === userId ? previous : null
  let view: 'error' | 'unknown' | 'guest' | 'empty' | 'result'
  if (failed) view = 'error'
  else if (!pending) view = analysis ? 'result' : signedIn ? 'empty' : 'guest'
  else view = (status === 'loading' ? previous : matching)?.kind ?? 'unknown'
  return {
    personal: view === 'result',
    analysis,
    loadingPreview: pending && view !== 'guest' && view !== 'empty',
    failed,
    footnote: status === 'error' ? '로그인 상태를 확인하지 못했어요. 내 취향에서 다시 확인해주세요.'
      : failed ? '저장된 결과를 불러오지 못했어요. 내 취향에서 다시 확인해주세요.'
        : view === 'guest' ? 'Spotify 계정 연결이 필요해요.' : null,
    actionLabel: view === 'result' ? '내 취향 보기' : view === 'guest' || view === 'empty' ? '내 음악 취향 분석하기' : '내 취향 확인하기',
    // A display hint never starts an analysis before the server confirms the session.
    actionTo: pending || failed || analysis ? '/result' : '/analyze',
  }
}
export type LandingPresentation = ReturnType<typeof useLandingPresentation>
