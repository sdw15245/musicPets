import { useEffect, useState } from 'react'
import AppHeader from '../../shared/components/AppHeader'

export default function LandingNavbar({ onNavigate }: { onNavigate?: (key: 'intro' | 'characters') => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  useEffect(() => {
    const onScroll = () => {
      // A section counts once its top passes the reading line: below the sticky header,
      // 40% into the rest of the viewport. A fixed offset lagged behind the visible heading.
      const header = document.querySelector('.app-header-surface')?.getBoundingClientRect().bottom ?? 0
      const line = header + (window.innerHeight - header) * 0.4
      const section = ['characters', 'intro'].find(id => {
        const bounds = document.getElementById(id)?.getBoundingClientRect()
        return bounds && bounds.top <= line && bounds.bottom > header
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
