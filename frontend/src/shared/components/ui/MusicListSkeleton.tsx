import { Skeleton } from '@seed-design/react'
import './music-list-skeleton.css'

export default function MusicListSkeleton({ compact = false, label, quiet = false }: { compact?: boolean; label: string; quiet?: boolean }) {
  return <div className={`music-list-skeleton${compact ? ' is-compact' : ''}`} role="status" aria-label={label}>
    <p className={quiet ? 'sr-only' : 'wf-sub'}>{label}</p>
    <div aria-hidden="true">
      {[0, 1, 2].map(index => <div className="music-skeleton-card" key={index}>
        <div className="music-skeleton-heading">
          <Skeleton radius={compact ? '16' : 'full'} width="x12" height="x12" />
          <div className="music-skeleton-copy"><Skeleton radius="8" width="45%" height="lineHeight.t5" /><Skeleton radius="8" width="65%" height="lineHeight.t4" /></div>
        </div>
        {!compact && <Skeleton radius="16" width="full" height="152px" />}
        <Skeleton radius="8" width="full" height="lineHeight.t5" />
        <Skeleton radius="8" width="75%" height="lineHeight.t5" />
      </div>)}
    </div>
  </div>
}
