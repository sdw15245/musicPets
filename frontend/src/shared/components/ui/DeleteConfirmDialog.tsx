import { AlertDialog, Portal, ResponsivePair } from '@seed-design/react'
import Button from './Button'
import ErrorNotice from './ErrorNotice'
import RequestLimitNotice from './RequestLimitNotice'
import { useRequestLimit } from '../../api/useRequestLimit'

interface Props {
  open: boolean
  title: string
  description: string
  busy?: boolean
  error?: string
  cause?: unknown
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export default function DeleteConfirmDialog({ open, title, description, busy, error, cause, onOpenChange, onConfirm }: Props) {
  const limit = useRequestLimit([cause])
  return <AlertDialog.Root open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }} closeOnEscape={!busy}>
    <Portal><AlertDialog.Positioner><AlertDialog.Backdrop /><AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
      </AlertDialog.Header>
      {limit ? <RequestLimitNotice limit={limit} /> : error && <ErrorNotice>{error}</ErrorNotice>}
      <AlertDialog.Footer>
        <ResponsivePair gap="x2">
          <AlertDialog.Action asChild><Button disabled={busy}>취소</Button></AlertDialog.Action>
          <Button variant="criticalSolid" loading={busy} disabled={busy || limit?.blocked} onClick={onConfirm}>삭제 확인</Button>
        </ResponsivePair>
      </AlertDialog.Footer>
    </AlertDialog.Content></AlertDialog.Positioner></Portal>
  </AlertDialog.Root>
}
