import type { ReactNode } from 'react'
import AppHeader from '../../shared/components/AppHeader'
import TasteNav from '../result/TasteNav'
import './personal.css'

export default function PersonalLayout({ title, description, children, taste = false, pending = false }: { title: string; description?: string; children: ReactNode; taste?: boolean; pending?: boolean }) {
  return <div className="personal-page">
    <AppHeader pending={pending} />
    <main className={`personal-main${taste ? ' personal-main-taste' : ''}`}>
      {/* Taste pages share one title like /result; the tab already names the section, so its heading is for assistive tech. */}
      {taste ? <>
        <h1>내 취향</h1>
        <TasteNav />
        <h2 className="sr-only">{title}</h2>
      </> : <h1>{title}</h1>}
      {description && <p className="personal-description">{description}</p>}
      {children}
    </main>
  </div>
}
