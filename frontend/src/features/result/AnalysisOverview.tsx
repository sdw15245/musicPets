import { useEffect, useState, type ReactNode } from 'react'
import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'
import AnalysisDetailStatus from './AnalysisDetailStatus'
import AnalysisMetricHelp from './AnalysisMetricHelp'
import { characters } from '../../shared/characters'

/** Counts up once when a fresh result arrives; saved results and reduced motion show the value at once. */
function MatchScore({ value, animate }: { value: number; animate: boolean }) {
  const [shown, setShown] = useState(() => animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value)
  useEffect(() => {
    if (shown === value) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - start) / 900, 1)
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
    // Runs once per mount: the key on ResultContent remounts for a new result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <>
    <span className="analysis-match-value"><strong>{shown}%</strong> 매칭</span>
    <span className="analysis-match-meter" aria-hidden="true"><span style={{ width: shown + '%' }} /></span>
  </>
}

export default function AnalysisOverview({ data, historical = false, reveal = false, actions, notices = [] }: { data: AnalysisResult; historical?: boolean; reveal?: boolean; actions?: ReactNode; notices?: string[] }) {
  const pet = data.character
  const catalog = characters.find(item => item.slug === pet?.slug)
  const story = catalog?.story
  // The pet stands on its own studio backdrop and its accent marks the result's data (pet-themes.css).
  return <section className={`analysis-overview${reveal ? ' is-new-result' : ''}`} data-pet={pet?.slug} aria-label="음악 취향 요약">
    {pet && <div className="analysis-pet pet-stage"><img className="pet-photo" src={catalog?.imageUrl ?? pet.imageUrl} alt={pet.name} width={640} height={640} /></div>}
    <div className="analysis-story">
      <div className="analysis-identity">
      <p className="analysis-period">{analysisPeriodLabel(data)} · {data.genres.trackCount}곡 분석</p>
      {/* Notes about how this result was made belong with the period they qualify. */}
      {!!notices.length && <aside className="analysis-notices" aria-label="분석 안내">{notices.map(warning => <p key={warning}>{warning}</p>)}</aside>}
      {pet ? <>
        <p className="analysis-pet-label">나를 닮은 음악 펫</p>
        <h2 className="analysis-pet-title">{pet.name}</h2>
        {catalog?.description && <p className="analysis-pet-description">{catalog.description}</p>}
        <div className="analysis-metric-label analysis-match">
          <MatchScore value={Math.round(pet.score * 100)} animate={reveal} />
          <AnalysisMetricHelp title="매칭 점수 안내" description="분석한 장르 비중이 펫의 기준 장르 분포와 얼마나 비슷한지 나타내요. 성격을 평가하는 점수는 아니에요." />
        </div>
      </> : <><h2>아직 음악 펫을 찾지 못했어요</h2><p>청취 기록이나 장르 정보가 부족해요. 음악을 더 듣고 다시 분석해주세요.</p></>}
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
