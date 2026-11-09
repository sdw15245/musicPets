import type { RequestLimitState } from '../../api/useRequestLimit'
import ErrorNotice from './ErrorNotice'

export default function RequestLimitNotice({ limit }: { limit: RequestLimitState }) {
  return (
    <ErrorNotice title={limit.app ? '요청이 잠시 제한됐어요' : limit.quota ? 'Spotify 사용량 한도에 도달했어요' : 'Spotify 요청이 잠시 제한됐어요'}>
        {limit.quota ? '현재 Spotify 사용량이 제한되어 있어요. 잠시 쉬었다가 다시 시도해주세요.'
          : '요청이 많아 잠시 기다려야 해요. 대기 후 다시 시도해주세요.'}
      <br />
        {limit.remaining > 0 ? `${limit.remaining}초 후 다시 시도할 수 있어요.` : '자동으로 재시도하지 않아요.'}
        {limit.quota && ' 대기가 끝나도 사용량 제한이 해제되지 않았을 수 있어요.'}
    </ErrorNotice>
  )
}
