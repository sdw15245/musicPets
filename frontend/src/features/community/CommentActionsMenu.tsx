import { Icon, Menu } from '@seed-design/react'
import { useEffect, useRef } from 'react'
import { IconDot3HorizontalLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'
import { useMenuFocus } from '../../shared/components/ui/useMenuFocus'

export default function CommentActionsMenu({ disabled, onEdit, onDelete }: {
  disabled: boolean
  onEdit: (trigger: HTMLButtonElement) => void
  onDelete: () => void
}) {
  const { open, onOpenChange, triggerRef, contentRef } = useMenuFocus()
  const pendingAction = useRef<((trigger: HTMLButtonElement) => void) | null>(null)
  useEffect(() => {
    if (open || !pendingAction.current) return
    let cancelled = false
    const frame = requestAnimationFrame(async () => {
      await Promise.all((contentRef.current?.getAnimations() ?? []).map(animation => animation.finished.catch(() => {})))
      if (cancelled) return
      const action = pendingAction.current
      pendingAction.current = null
      const trigger = triggerRef.current
      if (!trigger?.isConnected || trigger.closest('[hidden]')) return
      // Let the menu finish restoring focus before opening another focus destination.
      trigger.focus({ preventScroll: true })
      action?.(trigger)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open, contentRef, triggerRef])
  const select = (action: (trigger: HTMLButtonElement) => void) => {
    if (disabled) return
    pendingAction.current = action
    onOpenChange(false)
  }
  return <Menu.Root size="responsive" placement="bottom-end" gutter={8} open={open} onOpenChange={(next, details) => {
    if (next) pendingAction.current = null
    onOpenChange(next, details)
  }}>
    <Menu.Trigger asChild ref={triggerRef}>
      <Button size="small" variant="ghost" layout="iconOnly" color="fg.neutralMuted" disabled={disabled} aria-label="댓글 더보기" title="댓글 더보기">
        <Icon svg={<IconDot3HorizontalLine />} />
      </Button>
    </Menu.Trigger>
    <Menu.Positioner><Menu.Content ref={contentRef} aria-label="댓글 관리"><Menu.ScrollArea>
      <Menu.Group>
        <Menu.Item disabled={disabled} onClick={() => select(onEdit)}>
          <Menu.ItemBody><Menu.ItemLabel>댓글 수정</Menu.ItemLabel></Menu.ItemBody>
        </Menu.Item>
      </Menu.Group>
      <Menu.Group>
        <Menu.Item tone="critical" disabled={disabled} aria-haspopup="dialog" onClick={() => select(onDelete)}>
          <Menu.ItemBody><Menu.ItemLabel>댓글 삭제</Menu.ItemLabel></Menu.ItemBody>
        </Menu.Item>
      </Menu.Group>
    </Menu.ScrollArea></Menu.Content></Menu.Positioner>
  </Menu.Root>
}
