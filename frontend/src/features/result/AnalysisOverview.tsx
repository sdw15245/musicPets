import type { ReactNode } from 'react'
import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'
import AnalysisDetailStatus from './AnalysisDetailStatus'
import AnalysisMetricHelp from './AnalysisMetricHelp'
import { characters } from '../../shared/characters'

export default function AnalysisOverview({ data, historical = false, reveal = false, actions }: { data: AnalysisResult; historical?: boolean; reveal?: boolean; actions?: ReactNode }) {
  const pet = data.character
  const story = characters.find(item => item.slug === pet?.slug)?.story
  return <section className={`analysis-overview${reveal ? ' is-new-result' : ''}`} aria-label="음악 취향 요약">
    {pet && <div className="analysis-pet"><img src={pet.imageUrl} alt={pet.name} width={144} height={144} /></div>}
    <div className="analysis-story">
      <div className="analysis-identity">
      <p className="analysis-period">{analysisPeriodLabel(data)} · {data.genres.trackCount}곡 분석</p>
      {pet ? <div className="analysis-title-row">
        <h2 className="analysis-pet-title">{pet.name}</h2>
        <div className="analysis-metric-label"><span>{Math.round(pet.score * 100)}% 매칭</span><AnalysisMetricHelp title="매칭 점수 안내" description="분석한 장르 비중이 펫의 기준 장르 분포와 얼마나 비슷한지 나타내요. 성격을 평가하는 점수는 아니에요." /></div>
      </div> : <><h2>아직 음악 펫을 찾지 못했어요</h2><p>청취 기록이나 장르 정보가 부족해요. 음악을 더 듣고 다시 분석해주세요.</p></>}
      </div>
      <div className="profile-card">
        {data.profilePending ? historical ? <p>취향 해설이 완료되기 전에 저장된 기록이에요.</p> : <AnalysisDetailStatus id={data.id} section="profile" /> :
          <p className="profile-comment">{data.profile?.comment || '청취 기록에서 발견한 장르와 펫을 살펴보세요.'}</p>}
      </div>
      {actions && <div className="analysis-overview-actions">{actions}</div>}
      {story && <details className="pet-story"><summary>{pet?.name}의 이야기</summary><p>{story}</p></details>}
    </div>
  </section>
}
