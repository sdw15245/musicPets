import Button from '../../shared/components/ui/Button'
// 랜딩 하단 CTA 섹션. 저장된 분석 유무에 맞는 다음 행동 안내.
import { Link } from 'react-router-dom'
import { useCurrentAnalysisState } from '../analysis/useCurrentAnalysis'

function CtaSection() {
  const { analysis, pending, failed } = useCurrentAnalysisState()
  return (
    <section className="cta-section">
      <div className="section-shell cta-inner">
        <div>
          <div className="section-kicker">{analysis || failed ? '내 취향' : '시작하기'}</div>
          <h2 className="wf-h2">
            {failed ? '내 음악 취향을 확인해보세요' : analysis ? <>내 음악 취향과<br />나의 펫을 다시 만나보세요</> : <>지금 듣는 음악으로<br />나의 펫을 만나보세요</>}
          </h2>
          <p className="wf-sub">
            {failed ? '저장된 결과를 불러오지 못했어요. 내 취향에서 다시 확인해주세요.' : analysis
              ? '저장된 취향 요약과 펫 캐릭터를 한 화면에서 다시 확인할 수 있어요.'
              : 'Spotify를 연결하면 내 취향과 닮은 펫, 추천 아티스트를 함께 볼 수 있어요.'}
          </p>
        </div>
        <Button asChild variant="brandSolid" size="large"><Link to={pending || analysis || failed ? '/result' : '/analyze'}>{analysis ? '내 취향 보기' : pending || failed ? '내 취향 확인하기' : '내 음악 취향 분석하기'}</Link></Button>
      </div>
    </section>
  )
}

export default CtaSection
