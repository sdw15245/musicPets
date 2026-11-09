import { Icon, Skeleton } from '@seed-design/react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { IconBellLine } from '@karrotmarket/react-monochrome-icon'
import BrandLogo from './BrandLogo'
import Button from './ui/Button'
import ProfileMenu from '../../features/auth/ProfileMenu'
import { useAuthStore } from '../../features/auth/useAuthStore'
import { useUnreadCount } from '../../features/notifications/useNotifications'
import './app-header.css'

export default function AppHeader({ children, pending = false }: { children?: ReactNode; pending?: boolean }) {
  const signedIn = useAuthStore(state => !!state.accessToken)
  const restoring = useAuthStore(state => state.status === 'loading')
  const { pathname, search } = useLocation()
  const unread = useUnreadCount(!pending)
  const tasteActive = ['/result', '/history', '/pets'].some(path => pathname === path || pathname.startsWith(path + '/'))
  return <header className="app-header-surface">
    <div className="site-header app-header">
      <BrandLogo />
      <nav aria-label="메인 메뉴">
        {signedIn ? <Link className="site-nav-link" to="/result" aria-current={tasteActive ? 'page' : undefined}>내 취향</Link> : restoring ? <Skeleton aria-hidden="true" radius="8" width="64px" height="lineHeight.t5" /> : children}
        <NavLink className="site-nav-link" to="/community">커뮤니티</NavLink>
      </nav>
      <div className="app-header-account">
        {pending || restoring ? <Skeleton aria-hidden="true" radius="8" width="80px" height="40px" /> : signedIn ? <>
          <Button asChild variant="ghost" size="medium" layout="iconOnly" aria-label={unread.data ? `알림, 읽지 않은 알림 ${unread.data}개` : '알림'}>
            <Link className="notification-entry" to="/notifications" aria-label={unread.data ? `알림, 읽지 않은 알림 ${unread.data}개` : '알림'} aria-current={pathname === '/notifications' ? 'page' : undefined}>
              <Icon svg={<IconBellLine />} aria-hidden="true" />
              {!!unread.data && <span className="notification-dot" aria-hidden="true" />}
            </Link>
          </Button>
          <ProfileMenu />
        </> : pathname !== '/login' && <Button asChild variant="neutralWeak" size="medium"><Link to={pathname === '/' ? '/login' : '/login?next=' + encodeURIComponent(pathname + search)}>로그인</Link></Button>}
      </div>
    </div>
  </header>
}
