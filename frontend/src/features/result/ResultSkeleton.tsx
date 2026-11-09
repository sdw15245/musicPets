import { Skeleton } from '@seed-design/react'
import './result-skeleton.css'

export default function ResultSkeleton({ label = '저장된 분석 결과를 불러오고 있어요.' }: { label?: string }) {
  return <div className="result-skeleton" role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      <div className="result-toolbar"><Skeleton radius="8" width="176px" height="24px" /><Skeleton radius="8" width="96px" height="32px" /></div>
      <div className="analysis-overview result-skeleton-overview">
        <div className="result-skeleton-portrait"><Skeleton radius="16" width="full" height="full" /></div>
        <div className="result-skeleton-copy">
          <Skeleton radius="8" width="128px" height="20px" />
          <Skeleton radius="8" width="80px" height="40px" />
          <Skeleton radius="8" width="full" height="20px" />
          <Skeleton radius="8" width="80%" height="20px" />
          <Skeleton radius="8" width="152px" height="48px" />
        </div>
      </div>
    </div>
  </div>
}
