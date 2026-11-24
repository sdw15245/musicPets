import { Icon, useSnackbarAdapter } from '@seed-design/react'
import { Snackbar } from 'seed-design/ui/snackbar'
import { IconAndroidshareLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'

/** Copies the post's address so a single story can be passed along. */
export default function CopyPostLink({ path, trackName }: { path: string; trackName: string }) {
  const snackbar = useSnackbarAdapter()
  const notify = (variant: 'positive' | 'critical', message: string) =>
    snackbar.create({ render: () => <Snackbar variant={variant} message={message} /> })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href)
      notify('positive', '글 링크를 복사했어요.')
    } catch {
      notify('critical', '링크를 복사하지 못했어요. 주소창의 링크를 이용해주세요.')
    }
  }
  return <Button className="post-copy-link" variant="ghost" size="small" aria-label={`${trackName} 글 링크 복사`} onClick={() => void copy()}>
    <Icon svg={<IconAndroidshareLine />} />링크 복사
  </Button>
}
