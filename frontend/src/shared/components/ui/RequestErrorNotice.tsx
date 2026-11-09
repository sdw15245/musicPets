import type { ReactNode } from 'react'
import { useRequestLimit } from '../../api/useRequestLimit'
import ErrorNotice from './ErrorNotice'
import RequestLimitNotice from './RequestLimitNotice'

export default function RequestErrorNotice({ error, children, action }: {
  error: unknown; children: ReactNode; action?: (blocked: boolean) => ReactNode
}) {
  const limit = useRequestLimit([error])
  if (limit) return <>
    <RequestLimitNotice limit={limit} />
    {action && <div className="reco-actions">{action(limit.blocked)}</div>}
  </>
  return <ErrorNotice action={action?.(false)}>{children}</ErrorNotice>
}
