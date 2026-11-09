import { useEffect, useState } from 'react'
import { Dialog, Icon, Portal, Skeleton } from '@seed-design/react'
import { IconAndroidshareLine, IconXmarkLine } from '@karrotmarket/react-monochrome-icon'
import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'
import Button from '../../shared/components/ui/Button'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'

function SharePreview({ data }: { data: AnalysisResult }) {
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let disposed = false
    let url: string | undefined
    import('./resultShareImage').then(({ createResultShareImage }) => {
      if (disposed) return
      return createResultShareImage(data)
    }).then(file => {
      if (disposed || !file) return
      url = URL.createObjectURL(file)
      setImage({ file, url })
    }).catch(() => {
      if (!disposed) setError('공유 이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.')
    })
    return () => {
      disposed = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [data, attempt])

  const canShare = image && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [image.file] })

  const share = async () => {
    if (!image || sharing) return
    setSharing(true)
    setError('')
    try {
      // The image is prepared before this click to preserve browser user activation.
      await navigator.share({ files: [image.file], title: `MusicPets · ${data.character?.name}` })
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError('공유창을 열지 못했어요. 이미지를 저장한 뒤 SNS에 올려주세요.')
      }
    } finally { setSharing(false) }
  }

  return <>
    <Dialog.Body className="result-share-body">
      {(image || !error) && <div className="result-share-frame" aria-busy={!image}>
        {!image && <div className="result-share-placeholder" role="status" aria-label="공유 이미지를 만들고 있어요.">
          <Skeleton width="full" height="full" radius="8" aria-hidden="true" />
          <span className="sr-only">공유 이미지를 만들고 있어요.</span>
        </div>}
        {image && <img className="result-share-preview" src={image.url} alt={`${analysisPeriodLabel(data)}, ${data.character?.name} 펫과 취향 해설이 담긴 음악 취향 공유 이미지`} width={1080} height={1350} />}
      </div>}
      {error && <ErrorNotice action={!image && <Button size="small" onClick={() => { setError(''); setAttempt(value => value + 1) }}>이미지 다시 만들기</Button>}>{error}</ErrorNotice>}
    </Dialog.Body>
    <Dialog.Footer>
      <div className="result-share-actions">
        <Dialog.Action asChild><Button disabled={sharing}>닫기</Button></Dialog.Action>
        <Button variant={canShare ? 'neutralWeak' : 'brandSolid'} disabled={!image || sharing} onClick={() => {
          if (!image) return
          const link = document.createElement('a')
          link.href = image.url
          link.download = image.file.name
          document.body.append(link)
          link.click()
          link.remove()
        }}>PNG 저장하기</Button>
        {canShare && <Button variant="brandSolid" loading={sharing} disabled={sharing} onClick={() => void share()}>공유하기</Button>}
      </div>
    </Dialog.Footer>
  </>
}

export default function ResultShareDialog({ data }: { data: AnalysisResult }) {
  const [open, setOpen] = useState(false)
  if (!data.character) return null
  return <Dialog.Root size="medium" open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <Button variant="brandSolid" size="large"><Icon svg={<IconAndroidshareLine />} />결과 공유하기</Button>
    </Dialog.Trigger>
    <Portal><Dialog.Positioner><Dialog.Backdrop /><Dialog.Content className="result-share-dialog">
      <Dialog.Header>
        <Dialog.Title>음악 취향 공유 카드</Dialog.Title>
        <Dialog.Description>나를 닮은 펫과 음악 취향을 한 장에 담았어요.</Dialog.Description>
        <Dialog.CloseButton aria-label="공유창 닫기"><Icon svg={<IconXmarkLine />} /></Dialog.CloseButton>
      </Dialog.Header>
      <SharePreview data={data} />
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}
