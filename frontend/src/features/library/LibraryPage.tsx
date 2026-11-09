import { Link } from 'react-router-dom'
import PersonalLayout from '../mypage/PersonalLayout'
import Button from '../../shared/components/ui/Button'
import { ResultSection } from 'seed-design/ui/result-section'

export default function LibraryPage() {
  return <PersonalLayout title="음악 저장 안내" description="음악 보관함은 더 이상 제공하지 않아요.">
    <ResultSection size="medium" title="내 취향에서 음악을 발견해보세요" description="추천 아티스트는 Spotify에서, 사람들이 고른 곡은 커뮤니티에서 만날 수 있어요."
      actions={<Button asChild variant="brandSolid"><Link to="/result">내 취향으로 가기</Link></Button>} />
  </PersonalLayout>
}
