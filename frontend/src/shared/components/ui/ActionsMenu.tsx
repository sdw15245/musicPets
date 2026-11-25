import { Icon, Menu } from '@seed-design/react'
import { useEffect, useRef } from 'react'
import { IconDot3HorizontalLine } from '@karrotmarket/react-monochrome-icon'
import Button from './Button'
import { useMenuFocus } from './useMenuFocus'

export interface MenuAction {
  label: string
  onSelect: (trigger: HTMLButtonElement) => void
  /** Destructive actions sit in their own group, in the critical tone. */
  critical?: boolean
  opensDialog?: boolean
}

/** A "⋯" menu that runs the chosen action after the menu has closed and returned focus to its trigger. */
export default function ActionsMenu({ label, menuLabel, actions, disabled = false }: {
  label: string
  menuLabel: string
  actions: MenuAction[]
  disabled?: boolean
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
  const select = (action: MenuAction['onSelect']) => {
    if (disabled) return
    pendingAction.current = action
    onOpenChange(false)
  }
  const groups = [actions.filter(action => !action.critical), actions.filter(action => action.critical)].filter(group => group.length)
  return <Menu.Root size="responsive" placement="bottom-end" gutter={8} open={open} onOpenChange={(next, details) => {
    if (next) pendingAction.current = null
    onOpenChange(next, details)
  }}>
    <Menu.Trigger asChild ref={triggerRef}>
      <Button size="small" variant="ghost" layout="iconOnly" color="fg.neutralMuted" disabled={disabled} aria-label={label} title={label}>
        <Icon svg={<IconDot3HorizontalLine />} />
      </Button>
    </Menu.Trigger>
    <Menu.Positioner><Menu.Content ref={contentRef} aria-label={menuLabel}><Menu.ScrollArea>
      {groups.map(group => <Menu.Group key={group[0].label}>
        {group.map(action => <Menu.Item key={action.label} tone={action.critical ? 'critical' : undefined} disabled={disabled}
          aria-haspopup={action.opensDialog ? 'dialog' : undefined} onClick={() => select(action.onSelect)}>
          <Menu.ItemBody><Menu.ItemLabel>{action.label}</Menu.ItemLabel></Menu.ItemBody>
        </Menu.Item>)}
      </Menu.Group>)}
    </Menu.ScrollArea></Menu.Content></Menu.Positioner>
  </Menu.Root>
}
