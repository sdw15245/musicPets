import { Skeleton } from '@seed-design/react'

export default function ProfileSkeleton({ label = '프로필을 불러오고 있어요.', quiet = false }: { label?: string; quiet?: boolean }) {
  return <div className="mypage-profile-body mypage-profile-skeleton" role="status" aria-label={label}>
    <div aria-hidden="true"><Skeleton radius="full" width="x24" height="x24" /></div>
    <div aria-hidden="true"><Skeleton radius="8" width="60%" height="lineHeight.t8" /></div>
    <div aria-hidden="true"><Skeleton radius="8" width="full" height="lineHeight.t5" /></div>
    <p className={quiet ? 'sr-only' : 'wf-sub'}>{label}</p>
  </div>
}
