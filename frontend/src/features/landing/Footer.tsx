import BrandLogo from '../../shared/components/BrandLogo'
// 랜딩 페이지 푸터. 저작권 / 링크 표시.
function Footer() {
  return (
    <footer className="wf-footer">
      <BrandLogo compact />
      <div className="footer-links">
        <a className="nav-link" href="#top">소개</a>
        <a className="nav-link" href="mailto:hello@musicpets.app">문의</a>
      </div>
      <div>© 2026 MusicPets</div>
    </footer>
  )
}

export default Footer
