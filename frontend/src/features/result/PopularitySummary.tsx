import type { AnalysisResult } from '../analysis/schemas'
import AnalysisMetricHelp from './AnalysisMetricHelp'
import { isPopularityNotice, popularityNoticeText } from './analysisNotices'

export default function PopularitySummary({ data }: { data: AnalysisResult }) {
  if (data.profilePending) return null
  const obscurity = data.profile?.obscurity
  return <section className="popularity-summary" aria-label="음악 대중성">
    <h3>대중적인 곡과 숨은 곡 사이</h3>
    {obscurity == null ? <p className="wf-sub">청취자 수 정보가 부족해 대중성을 계산하지 못했어요.</p> : <div className="profile-meter">
      <div className="profile-meter-labels"><span>대중적</span><span>마이너</span></div>
      <div className="genre-track"><div className="genre-fill" style={{ width: obscurity + '%' }} /></div>
      <div className="analysis-metric-label"><p className="profile-meter-cap">마이너함 {Math.round(obscurity)}%</p><AnalysisMetricHelp title="대중성 지표 안내" description="Last.fm에서 확인한 곡별 청취자 수로 추정해요. 청취자가 적은 곡을 많이 들을수록 높아지며, 청취자 수를 확인하지 못한 곡은 제외해요." /></div>
    </div>}
    {data.warnings.filter(isPopularityNotice).map(warning => <p className="popularity-coverage" key={warning}>{popularityNoticeText(warning)}</p>)}
  </section>
}
