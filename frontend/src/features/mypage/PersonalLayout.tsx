import type { ReactNode } from 'react'
import AppHeader from '../../shared/components/AppHeader'
import TasteNav from '../result/TasteNav'
import './personal.css'

export default function PersonalLayout({ title, description, children, taste = false, pending = false }: { title: string; description?: string; children: ReactNode; taste?: boolean; pending?: boolean }) {
  return <div className="personal-page">
    <AppHeader pending={pending} />
    <main className={`personal-main${taste ? ' personal-main-taste' : ''}`}>
      <h1>{title}</h1>{description && <p className="personal-description">{description}</p>}
      {taste && <TasteNav />}
      {children}
    </main>
  </div>
}
