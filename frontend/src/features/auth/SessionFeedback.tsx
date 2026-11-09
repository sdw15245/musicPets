import { restoreSession } from './session'
import LoadingStatus from '../../shared/components/ui/LoadingStatus'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import Button from '../../shared/components/ui/Button'
import PagePending from '../../shared/components/PagePending'

export default function SessionFeedback({ status, preserveLayout = false }: { status: 'loading' | 'error'; preserveLayout?: boolean }) {
  const error = <ErrorNotice action={<Button onClick={() => void restoreSession()}>다시 확인하기</Button>}>
    로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.
  </ErrorNotice>
  if (preserveLayout) return <PagePending label="로그인 정보를 확인하고 있어요.">{status === 'error' ? error : undefined}</PagePending>
  return <main className="auth-page">
    {status === 'loading'
      ? <LoadingStatus>로그인 정보를 확인하고 있어요.</LoadingStatus>
      : error}
  </main>
}
