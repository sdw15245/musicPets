import { useSnackbarAdapter } from '@seed-design/react'
import { Snackbar } from 'seed-design/ui/snackbar'

export function useSuccessNotice() {
  const adapter = useSnackbarAdapter()
  return (message: string) => adapter.create({ render: () => <Snackbar variant="positive" message={message} /> })
}
