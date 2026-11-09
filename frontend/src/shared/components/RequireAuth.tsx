// 로그인 확인이 끝난 뒤에만 보호 화면을 열거나 /login으로 보낸다.
import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/useAuthStore'
import SessionFeedback from '../../features/auth/SessionFeedback'

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const status = useAuthStore((s) => s.status)

  if (status !== 'ready') return <SessionFeedback status={status} preserveLayout />

  if (!accessToken) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <>{children}</>
}

export default RequireAuth
