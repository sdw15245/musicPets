import Button from '../../shared/components/ui/Button'
import { Link, useLocation } from 'react-router-dom'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import { loginDestination } from './loginDestination'

export default function SpotifyReconnectNotice() {
  const location = useLocation()
  const next = loginDestination(location.pathname + location.search)
  return (
    <ErrorNotice title="Spotify에 다시 연결해주세요" action={<Button asChild variant="brandSolid"><Link to={`/login?next=${encodeURIComponent(next)}`}>Spotify 다시 연결</Link></Button>}>
      Spotify 연결이 만료되었거나 해제됐어요. 다시 로그인하면 계속 이용할 수 있어요.
    </ErrorNotice>
  )
}
