import { ProgressCircle } from 'seed-design/ui/progress-circle'

export default function LoadingStatus({ children }: { children: string }) {
  return <div className="loading-status" role="status">
    <ProgressCircle size="24" aria-hidden="true" />
    <span>{children}</span>
  </div>
}
