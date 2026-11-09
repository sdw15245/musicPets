import { NavLink } from 'react-router-dom'

export default function TasteNav() {
  return <nav className="taste-nav" aria-label="내 취향 메뉴">
    <NavLink to="/result">최근 결과</NavLink>
    <NavLink to="/history">분석 기록</NavLink>
    <NavLink to="/pets">만난 펫</NavLink>
  </nav>
}
