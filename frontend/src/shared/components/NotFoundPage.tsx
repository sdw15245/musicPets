import { Link } from 'react-router-dom'
import { ResultSection } from 'seed-design/ui/result-section'
import BrandLogo from './BrandLogo'
import Button from './ui/Button'

export default function NotFoundPage() {
  return <main className="auth-page">
    <div className="state-card">
      <BrandLogo />
      <ResultSection headingLevel={1} title="페이지를 찾을 수 없어요" description="주소가 변경되었거나 없는 페이지예요. 홈에서 다시 시작해주세요."
        actions={<Button asChild variant="brandSolid"><Link to="/">홈으로 가기</Link></Button>} />
    </div>
  </main>
}
