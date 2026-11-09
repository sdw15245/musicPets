import { useEffect, useRef, useState } from 'react'

// Opening focus can still be queued when Escape closes the menu immediately.
export function useMenuFocus() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const restore = useRef(false)
  useEffect(() => {
    if (open || !restore.current) return
    let cancelled = false
    const frame = requestAnimationFrame(async () => {
      await Promise.all((contentRef.current?.getAnimations() ?? []).map(animation => animation.finished.catch(() => {})))
      if (!cancelled && restore.current) { triggerRef.current?.focus({ preventScroll: true }); restore.current = false }
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open])
  return { open, triggerRef, contentRef, onOpenChange: (next: boolean, details?: { reason?: string }) => {
    restore.current = !next && details?.reason === 'escapeKeyDown'
    setOpen(next)
  } }
}
