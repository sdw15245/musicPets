import { useEffect, useRef, useState } from 'react'

export function useChartReveal(enabled = true) {
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!enabled || !sectionRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setRevealed(true)
      observer.disconnect()
    }, { threshold: 0.1 })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [enabled])
  return { sectionRef, revealed }
}
