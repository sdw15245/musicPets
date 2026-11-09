import { Link } from 'react-router-dom'
import './brand-logo.css'

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand-logo${compact ? ' brand-logo--compact' : ''}`}>
    Music<span>Pets</span>
  </Link>
}
