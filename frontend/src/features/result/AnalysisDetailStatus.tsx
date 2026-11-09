import Button from '../../shared/components/ui/Button'
import LoadingStatus from '../../shared/components/ui/LoadingStatus'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import { ApiError, isSpotifyReauthorizationRequired } from '../../shared/api/error'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../auth/useAuthStore'
import { latestAnalysisQuery, type AnalysisDetail } from '../analysis/analysisQuery'
import SpotifyReconnectNotice from '../auth/SpotifyReconnectNotice'
import { useAnalysisDetail } from './useResultActions'
import { Skeleton } from '@seed-design/react'

export default function AnalysisDetailStatus({ id, section, artists = false }: { id: string; section: AnalysisDetail; artists?: boolean }) {
  const { isError, error, refetch } = useAnalysisDetail(id, section)
  const client = useQueryClient()
  const sessionId = useAuthStore(state => state.sessionId)
  const profile = section === 'profile'
  if (!isError && profile) return <div className="taste-reading-placeholder" role="status" aria-live="polite" aria-label="취향 설명을 쓰고 있어요.">
    <div className="taste-reading-lines" aria-hidden="true">
      <Skeleton tone="magic" radius="8" height="lineHeight.t6" width="full" />
      <Skeleton tone="magic" radius="8" height="lineHeight.t6" width="full" />
      <Skeleton tone="magic" radius="8" height="lineHeight.t6" width="70%" />
    </div>
    <p className="taste-reading-loading-text">취향 설명을 쓰고 있어요.</p>
  </div>
  if (!isError) return <LoadingStatus>{artists ? '추천 아티스트를 찾고 있어요.' : '추천곡을 찾고 있어요.'}</LoadingStatus>
  if (isSpotifyReauthorizationRequired(error)) return <SpotifyReconnectNotice />
  if (error instanceof ApiError && error.status === 409) return <RequestErrorNotice error={error} action={() =>
    <Button onClick={() => void client.invalidateQueries({ queryKey: latestAnalysisQuery(sessionId).queryKey, exact: true })}>최신 결과 보기</Button>}>
    분석 결과가 바뀌었어요. 최신 결과를 확인해주세요.
  </RequestErrorNotice>
  return <RequestErrorNotice error={error} action={blocked =>
    <Button disabled={blocked} onClick={() => void refetch()}>다시 시도</Button>}>
    {profile ? '취향 설명을 불러오지 못했어요.' : artists ? '추천 아티스트를 불러오지 못했어요.' : '추천곡을 불러오지 못했어요.'}
  </RequestErrorNotice>
}
