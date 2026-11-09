// HttpOnly 쿠키로 세션을 복구한 뒤 로그인을 시작한 화면으로 돌아간다.
import { useEffect, useRef } from 'react'
import { ProgressCircle } from '@seed-design/react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from './useAuthStore'
import { loginDestination } from './loginDestination'
import SessionFeedback from './SessionFeedback'

function OAuthCallback() {
  const navigate = useNavigate()
  const access = useAuthStore((s) => s.accessToken)
  const status = useAuthStore((s) => s.status)
  const handled = useRef(false)

  useEffect(() => {
    if (status !== 'ready' || handled.current) return
    handled.current = true
    if (access) {
      const destination = loginDestination(sessionStorage.getItem('login-destination'))
      sessionStorage.removeItem('login-destination')
      sessionStorage.removeItem('login-account-switch')
      navigate(destination, { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [access, navigate, status])

  if (status !== 'ready') return <SessionFeedback status={status} />

  return (
    <main className="auth-page">
      <section className="state-card" aria-live="polite">
        <div className="section-kicker">Login</div>
        <h1 className="wf-h3" style={{ marginBottom: 14 }}>Spotify 연결을 확인하고 있습니다</h1>
        <ProgressCircle.Root aria-label="Spotify 연결 확인 중">
          <ProgressCircle.Track /><ProgressCircle.Range />
        </ProgressCircle.Root>
      </section>
    </main>
  )
}

export default OAuthCallback
