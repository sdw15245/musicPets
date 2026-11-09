import { Link } from 'react-router-dom'
import { Skeleton } from '@seed-design/react'
import Button from '../../shared/components/ui/Button'
import TastePreview from '../../shared/components/TastePreview'
import { useCurrentAnalysisState } from '../analysis/useCurrentAnalysis'
import { useAuthStore } from '../auth/useAuthStore'

interface HeroSectionProps {
  onNavigate?: (key: 'intro' | 'characters') => void
}

function HeroSection({ onNavigate }: HeroSectionProps) {
  const { analysis, pending, failed } = useCurrentAnalysisState()
  const signedIn = useAuthStore(state => !!state.accessToken)
  return <section className="music-hero">
    <div className="music-hero-copy">
      <div className="hero-eyebrow">음악으로 만나는 나의 취향</div>
      <h1>{pending ? <span className="hero-copy-skeleton" aria-label="음악 취향 화면 준비 중"><Skeleton asChild radius="8" width="90%" height="1em"><span /></Skeleton><Skeleton asChild radius="8" width="65%" height="1em"><span /></Skeleton></span> : analysis ? <>음악으로 발견한,<br /><em>나의 취향.</em></> : <>좋아하는 음악 속에,<br /><em>나를 닮은 펫.</em></>}</h1>
      {pending ? <div className="hero-copy-skeleton" aria-hidden="true"><Skeleton radius="8" width="85%" height="lineHeight.t6" /><Skeleton radius="8" width="70%" height="lineHeight.t6" /></div> :
        <p>{analysis ? <>최근 분석한 음악 취향과 추천 아티스트를<br />저장된 결과에서 다시 확인해보세요.</> : <>최근 4주, 내가 즐겨 들은 음악은 어떤 모습일까요?<br />나를 닮은 음악 펫을 찾고 친구와 나눠보세요.</>}</p>}
      <div className="music-hero-actions">
        {pending ? <Button variant="brandSolid" size="large" loading disabled>불러오는 중</Button> :
          <Button asChild variant="brandSolid" size="large"><Link to={analysis || failed ? '/result' : '/analyze'}>{analysis ? '내 취향 보기' : failed ? '내 취향 확인하기' : '내 음악 취향 분석하기'}</Link></Button>}
        <Button className="hero-how-link" variant="ghost" onClick={() => onNavigate?.('intro')} size="large">이용 방법 보기</Button>
      </div>
      {!pending && (failed || !signedIn) && <p className="hero-footnote">{failed ? '저장된 결과를 불러오지 못했어요. 내 취향에서 다시 확인해주세요.' : 'Spotify 계정 연결이 필요해요.'}</p>}
    </div>
    <div className="hero-result-preview">{pending ? <div className="taste-preview" role="status" aria-label="음악 취향을 불러오는 중">
      <Skeleton radius="8" width="40%" height="lineHeight.t5" />
      <Skeleton radius="16" width="full" height="176px" />
      <Skeleton radius="8" width="75%" height="lineHeight.t5" />
    </div> : failed ? <div className="taste-preview"><p>저장된 음악 취향을 확인하지 못했어요.</p><Button asChild variant="ghost"><Link to="/result">결과 다시 확인하기</Link></Button></div> : <TastePreview analysis={analysis} />}</div>
  </section>
}

export default HeroSection
