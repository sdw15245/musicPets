import AppHeader from '../../shared/components/AppHeader'
import Button from '../../shared/components/ui/Button'
import { Link, useSearchParams } from 'react-router-dom'
import { loginDestination } from './loginDestination'
import { SPOTIFY_LOGIN_URL } from '../../shared/api/config'
import { Callout } from '@seed-design/react'
import { IconCheckmarkLine } from '@karrotmarket/react-monochrome-icon'
import AccountSwitch from './AccountSwitch'
import { characters } from '../../shared/characters'

// Three pets on their own colour tiles; the middle one leads.
const showcase = ['mochi', 'pip', 'bongbong'].map(slug => characters.find(pet => pet.slug === slug)!)

export default function LoginPage() {
  const [params] = useSearchParams()
  const oauthFailed = params.get('oauthError') === 'spotify'
  const destination = params.get('next') ?? (oauthFailed ? sessionStorage.getItem('login-destination') : null)
  const switching = params.get('switchAccount') === 'true'
    || (oauthFailed && sessionStorage.getItem('login-account-switch') === 'true')
  return <div className="login-page">
    <AppHeader />
    <main className={`login-layout${switching ? '' : ' login-layout--split'}`}>
      {switching ? <AccountSwitch destination={destination} oauthFailed={oauthFailed} /> : <>
        <div className="login-visual" aria-hidden="true">
          <div className="login-pets">{showcase.map(pet => <span key={pet.slug} className="login-pet" style={{ backgroundColor: pet.color }}>
            <img src={pet.imageUrl} alt="" />
          </span>)}</div>
          <p className="login-visual-caption">어떤 펫이 나를 닮았을까요?</p>
        </div>
        <section className="login-copy">
          <header className="login-heading"><h1>나의 음악 펫을 만나보세요</h1>
            <p>Spotify 계정으로 바로 시작할 수 있어요.</p></header>
          {oauthFailed && <Callout.Root tone="critical" role="alert"><Callout.Content>
            <Callout.Title>Spotify 연결을 완료하지 못했어요</Callout.Title>
            <Callout.Description>로그인이 취소되었거나 연결 중 문제가 생겼어요. 다시 연결해주세요.</Callout.Description>
          </Callout.Content></Callout.Root>}
          <Button className="spotify-sign-in" variant="neutralSolid" size="large" aria-label="Spotify로 계속하기" onClick={() => {
            sessionStorage.removeItem('login-account-switch')
            sessionStorage.setItem('login-destination', loginDestination(destination))
            window.location.href = SPOTIFY_LOGIN_URL
          }}>Spotify로 계속하기</Button>
          {/* Matches the backend OAuth scopes: profile, email, top tracks, playlist creation. */}
          <ul className="login-scope" aria-label="Spotify에서 사용하는 정보">
            <li><IconCheckmarkLine size={16} aria-hidden="true" />Spotify 프로필과 자주 들은 곡 목록만 읽어요.</li>
            <li><IconCheckmarkLine size={16} aria-hidden="true" />플레이리스트는 직접 저장을 누를 때만 만들어요.</li>
          </ul>
          <div className="login-secondary"><span>다른 Spotify 계정을 쓰고 있나요?</span><Link to={`/login?switchAccount=true${destination ? '&next=' + encodeURIComponent(destination) : ''}`}>다른 계정으로 로그인</Link></div>
        </section>
      </>}
    </main>
  </div>
}
