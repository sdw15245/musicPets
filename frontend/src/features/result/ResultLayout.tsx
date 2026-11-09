import type { ReactNode } from 'react'
import AppHeader from '../../shared/components/AppHeader'
import TasteNav from './TasteNav'

export default function ResultLayout({ children, pending = false }: { children: ReactNode; pending?: boolean }) {
  return <div className="result-page"><AppHeader pending={pending} /><main className="result-shell">
    <header className="result-heading"><h1>내 취향</h1></header><TasteNav />
    {children}
  </main></div>
}
