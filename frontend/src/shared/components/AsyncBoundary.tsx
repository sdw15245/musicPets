import Button from './ui/Button'
import { ResultSection } from 'seed-design/ui/result-section'
import { ProgressCircle } from '@seed-design/react'
// Suspense + ErrorBoundary 통합 래퍼. useSuspenseQuery 사용 페이지에서 로딩/에러 처리 자동화.
import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { QueryErrorResetBoundary } from '@tanstack/react-query'

interface AsyncBoundaryProps {
  children: ReactNode
  loadingFallback?: ReactNode
  errorFallback?: (props: FallbackProps) => ReactNode
}

const DefaultLoading = () => (
  <div className="state-card" aria-busy="true" aria-live="polite">
    <ProgressCircle.Root aria-label="불러오는 중"><ProgressCircle.Track /><ProgressCircle.Range /></ProgressCircle.Root>
    <p>잠시만 기다려주세요.</p>
  </div>
)

// Raw messages (HTTP status, schema paths) belong in logs, not on screen.
const DefaultError = ({ resetErrorBoundary }: FallbackProps) => (
  <div className="state-card">
    <ResultSection title="화면을 불러오지 못했어요"
      description="연결 상태를 확인하고 다시 시도해주세요."
      actions={<Button onClick={resetErrorBoundary}>다시 시도</Button>} />
  </div>
)

function AsyncBoundary({
  children,
  loadingFallback = <DefaultLoading />,
  errorFallback = DefaultError,
}: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} fallbackRender={errorFallback}>
          <Suspense fallback={loadingFallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

export default AsyncBoundary
