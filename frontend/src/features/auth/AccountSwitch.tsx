import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Callout } from '@seed-design/react'
import { IconArrowUpRightLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'
import { SPOTIFY_LOGIN_URL } from '../../shared/api/config'
import { useLogout, useMe } from './useAuth'
import { useAuthStore } from './useAuthStore'
import { loginDestination } from './loginDestination'

export default function AccountSwitch({ destination, oauthFailed }: { destination: string | null; oauthFailed: boolean }) {
  const { data: me } = useMe()
  const status = useAuthStore(s => s.status)
  const signedIn = useAuthStore(s => !!s.accessToken)
  const logout = useLogout()
  const [connecting, setConnecting] = useState(false)
  const [failed, setFailed] = useState(false)

  async function connect() {
    if (connecting) return
    setConnecting(true)
    setFailed(false)
    try {
      // Clear the refresh session even if restoration failed, before starting OAuth.
      await logout.mutateAsync()
      sessionStorage.setItem('login-destination', loginDestination(destination))
      sessionStorage.setItem('login-account-switch', 'true')
      window.location.href = `${SPOTIFY_LOGIN_URL}?switch_account=true`
    } catch {
      setFailed(true)
      setConnecting(false)
    }
  }

  return <section className="login-copy account-switch">
    <header className="login-heading"><h1>Spotify 계정 변경</h1></header>
    {oauthFailed && <Callout.Root tone="critical" role="alert"><Callout.Content>
      <Callout.Title>Spotify 연결을 완료하지 못했어요. 다시 연결해주세요.</Callout.Title>
    </Callout.Content></Callout.Root>}
    {me && <p className="account-switch-current">현재 연결된 계정 <strong>{me.spotifyId}</strong></p>}
    <ol className="account-switch-steps" aria-label="계정 변경 순서">
      <li><span className="account-step-number" aria-hidden="true">1</span><div>
        <h2>Spotify에서 계정 바꾸기</h2>
        <p>로그아웃 후 원하는 계정으로 로그인하세요.</p>
        <Button asChild variant="neutralWeak" size="medium"><a href="https://www.spotify.com/account/" target="_blank" rel="noreferrer">Spotify 웹사이트 열기 <IconArrowUpRightLine size={16} aria-hidden="true" /><span className="sr-only"> (새 탭)</span></a></Button>
      </div></li>
      <li><span className="account-step-number" aria-hidden="true">2</span><div>
        <h2>MusicPets에 연결하기</h2>
        <p>계정을 바꿨다면 여기서 계속하세요.</p>
        <Button variant="brandSolid" size="large" loading={connecting} disabled={connecting || status === 'loading'} onClick={() => void connect()}>변경한 계정으로 계속하기</Button>
      </div></li>
    </ol>
    {failed && <Callout.Root tone="critical" role="alert"><Callout.Content>
      <Callout.Title>로그아웃하지 못했어요. 다시 시도해주세요.</Callout.Title>
    </Callout.Content></Callout.Root>}
    {!connecting && <div className="login-secondary"><Link to={signedIn ? '/mypage' : `/login${destination ? '?next=' + encodeURIComponent(destination) : ''}`}>취소</Link></div>}
  </section>
}
