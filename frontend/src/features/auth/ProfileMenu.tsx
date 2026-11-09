import { useMenuFocus } from '../../shared/components/ui/useMenuFocus'
import { Icon, Menu, useSnackbarAdapter } from '@seed-design/react'
import { Snackbar } from 'seed-design/ui/snackbar'
import { IconPersonLine } from '@karrotmarket/react-monochrome-icon'
import { Link } from 'react-router-dom'
import Button from '../../shared/components/ui/Button'
import { useLogout } from './useAuth'
import { useProfile } from '../profile/useProfile'
import { useAuthStore } from './useAuthStore'

export default function ProfileMenu() {
  const signedIn = useAuthStore(s => !!s.accessToken)
  const profile = useProfile()
  const logout = useLogout()
  const snackbar = useSnackbarAdapter()
  const { open, onOpenChange, triggerRef, contentRef } = useMenuFocus()
  if (!signedIn) return null
  return <div className="landing-nav-account">
    <Menu.Root size="responsive" placement="bottom-end" gutter={8} open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger asChild ref={triggerRef}><Button variant="ghost" size="medium" layout="iconOnly" color="fg.neutralMuted" aria-label="프로필" title="프로필" loading={logout.isPending} disabled={logout.isPending}><Icon size="x7" svg={<IconPersonLine />} /></Button></Menu.Trigger>
      <Menu.Positioner className="landing-account-positioner"><Menu.Content ref={contentRef}><Menu.ScrollArea>
        <Menu.Group>
          <Menu.GroupLabel className="landing-account-name">{profile.name}</Menu.GroupLabel>
          <Menu.Item asChild><Link to="/mypage"><Menu.ItemBody><Menu.ItemLabel>내 프로필</Menu.ItemLabel></Menu.ItemBody></Link></Menu.Item>
          <Menu.Item onClick={() => logout.mutate(undefined, { onError: () => snackbar.create({
            render: () => <Snackbar variant="critical" message="로그아웃하지 못했어요. 다시 시도해주세요." />,
          }) })} disabled={logout.isPending}><Menu.ItemBody><Menu.ItemLabel>로그아웃</Menu.ItemLabel></Menu.ItemBody></Menu.Item>
        </Menu.Group>
      </Menu.ScrollArea></Menu.Content></Menu.Positioner>
    </Menu.Root>
  </div>
}
