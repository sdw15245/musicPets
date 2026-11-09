import { useEffect, useState } from 'react'
import AppHeader from '../../shared/components/AppHeader'

export default function LandingNavbar({ onNavigate }: { onNavigate?: (key: 'intro' | 'characters') => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  useEffect(() => {
    const onScroll = () => {
      const section = ['intro', 'characters'].find(id => {
        const bounds = document.getElementById(id)?.getBoundingClientRect()
        return bounds && bounds.top <= 180 && bounds.bottom > 180
      })
      setActiveSection(section ?? null)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])
  return <AppHeader>
    <button className="site-nav-link" aria-current={activeSection === 'intro' ? 'location' : undefined} onClick={() => onNavigate?.('intro')}>이용 방법</button>
    <button className="site-nav-link" aria-current={activeSection === 'characters' ? 'location' : undefined} onClick={() => onNavigate?.('characters')}>캐릭터</button>
  </AppHeader>
}
