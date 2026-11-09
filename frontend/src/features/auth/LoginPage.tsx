import AppHeader from '../../shared/components/AppHeader'
import Button from '../../shared/components/ui/Button'
import { Link, useSearchParams } from 'react-router-dom'
import { loginDestination } from './loginDestination'
import { SPOTIFY_LOGIN_URL } from '../../shared/api/config'
import { Callout } from '@seed-design/react'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import AccountSwitch from './AccountSwitch'

export default function LoginPage() {
  const [params] = useSearchParams()
  const oauthFailed = params.get('oauthError') === 'spotify'
  const destination = params.get('next') ?? (oauthFailed ? sessionStorage.getItem('login-destination') : null)
  const switching = params.get('switchAccount') === 'true'
    || (oauthFailed && sessionStorage.getItem('login-account-switch') === 'true')
  return <div className="login-page">
    <AppHeader />
    <main className="login-layout">
      {switching ? <AccountSwitch destination={destination} oauthFailed={oauthFailed} /> : <section className="login-copy">
        <header className="login-heading"><h1>MusicPets 로그인</h1>
          <p>Spotify 계정으로 시작하세요.</p></header>
        {oauthFailed && <Callout.Root tone="critical" role="alert"><Callout.Content>
          <Callout.Title>Spotify 연결을 완료하지 못했어요</Callout.Title>
          <Callout.Description>로그인이 취소되었거나 연결 중 문제가 생겼어요. 다시 연결해주세요.</Callout.Description>
        </Callout.Content></Callout.Root>}
        <Button className="spotify-sign-in" variant="neutralSolid" size="large" aria-label="Spotify로 계속하기" onClick={() => {
          sessionStorage.removeItem('login-account-switch')
          sessionStorage.setItem('login-destination', loginDestination(destination))
          window.location.href = SPOTIFY_LOGIN_URL
        }}><SpotifyLogo /><span>로 계속하기</span></Button>
        <div className="login-secondary"><Link to={`/login?switchAccount=true${destination ? '&next=' + encodeURIComponent(destination) : ''}`}>다른 계정으로 로그인</Link></div>
      </section>}
    </main>
  </div>
}
