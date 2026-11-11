import { useEffect, useState, type RefObject } from 'react'

/** Keep the secondary action available only after the heading action is passed. */
export function useFloatingComposer(trigger: RefObject<HTMLButtonElement | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const button = trigger.current
    const header = document.querySelector('.app-header-surface')
    if (!button) return
    let observer: IntersectionObserver
    const observe = () => {
      observer?.disconnect()
      const top = header?.getBoundingClientRect().height ?? 0
      observer = new IntersectionObserver(([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= top)
      }, { rootMargin: `-${top}px 0px 0px 0px` })
      observer.observe(button)
    }
    observe()
    const resize = new ResizeObserver(observe)
    if (header) resize.observe(header)
    return () => { observer.disconnect(); resize.disconnect() }
  }, [trigger])
  return visible
}
