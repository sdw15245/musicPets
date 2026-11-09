import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useLocation } from 'react-router-dom'
import Button from './ui/Button'
import ErrorNotice from './ui/ErrorNotice'
import PagePending from './PagePending'

function RouteError() {
  return <PagePending>
    <ErrorNotice action={<Button onClick={() => window.location.reload()}>새로고침</Button>}>
      화면을 불러오지 못했어요. 연결을 확인한 후 새로고침해 주세요.
    </ErrorNotice>
  </PagePending>
}

export default function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary FallbackComponent={RouteError} resetKeys={[pathname]}>
    <Suspense fallback={<PagePending />}>
      {children}
    </Suspense>
  </ErrorBoundary>
}
