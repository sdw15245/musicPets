import { useId, useState } from 'react'
import Button from '../../shared/components/ui/Button'
import type { AnalysisResult } from '../analysis/schemas'
import { analysisPeriod, analysisPeriodLabel } from '../analysis/analysisPeriod'
import { analysisDate } from './historyFormat'
import { genreLabel } from '../analysis/genreLabels'
import './taste-comparison.css'

import { genrePercent as percent, genreDifference } from '../analysis/genreComparison'

function PetSummary({ record }: { record: AnalysisResult }) {
  return <div className="comparison-pet">
    <span>{record.character?.name ?? '펫 정보 없음'}</span>
    <span className="comparison-track-count">{analysisPeriodLabel(record)} · {record.genres.trackCount}곡 분석</span>
  </div>
}

export default function TasteComparison({ records }: { records: AnalysisResult[] }) {
  const [selected, setSelected] = useState(records[1].id)
  const [expanded, setExpanded] = useState(false)
  const selectId = useId()
  const listId = useId()
  const latest = records[0]
  const previous = records.find(record => record.id === selected && record.id !== latest.id) ?? records[1]
  const changes = [...new Set([...Object.keys(latest.genres.vector), ...Object.keys(previous.genres.vector)])]
    .filter(genre => (latest.genres.vector[genre] ?? 0) > 0 || (previous.genres.vector[genre] ?? 0) > 0)
    .map(genre => {
      const before = percent(previous.genres.vector[genre]), after = percent(latest.genres.vector[genre])
      // Match the displayed precision, so 5.2 → 5.5 is consistently +0.3%p.
      return { genre, name: genreLabel(genre), before, after, difference: genreDifference(previous.genres.vector[genre], latest.genres.vector[genre]) }
    })
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || b.after - a.after)
    .slice(0, 5)
  const largest = changes[0]
  const visible = expanded ? changes : changes.slice(0, 2)

  return <section className="taste-comparison" aria-labelledby="comparison-title">
    <header className="comparison-heading"><h2 id="comparison-title">취향 변화</h2></header>
    <div className="comparison-pet-change">
      {previous.character && <img src={previous.character.imageUrl} width={56} height={56} alt="" />}
      <strong>{previous.character?.slug === latest.character?.slug && latest.character ? `${latest.character.name}를 다시 만났어요` : `${previous.character?.name ?? '펫 없음'} → ${latest.character?.name ?? '펫 없음'}`}</strong>
      {latest.character && <img src={latest.character.imageUrl} width={56} height={56} alt="" />}
    </div>
    <div className="comparison-periods">
      <div className="comparison-period">
        <label htmlFor={selectId}>이전 기록</label>
        <select id={selectId} aria-label="비교할 이전 기록" value={previous.id} onChange={event => { setSelected(event.target.value); setExpanded(false) }}>
          {records.slice(1).map(record => <option value={record.id} key={record.id}>{analysisDate(record.analyzedAt)}</option>)}
        </select>
        <PetSummary record={previous} />
      </div>
      <span className="comparison-arrow" aria-hidden="true">→</span>
      <div className="comparison-period">
        <span className="comparison-period-label">최근 기록</span>
        <time dateTime={latest.analyzedAt}>{analysisDate(latest.analyzedAt)}</time>
        <PetSummary record={latest} />
      </div>
    </div>
    {analysisPeriod(previous) !== analysisPeriod(latest) && <p className="comparison-note">두 기록의 분석 기간이 달라요. 기간 차이도 결과에 영향을 줄 수 있어요.</p>}
    {largest ? <>
      <div key={previous.id} className="comparison-highlight">
        <p>{largest.difference === 0 ? '두 기록의 장르 비중이 같아요.' : `${largest.name} 비중이 가장 크게 ${largest.difference > 0 ? '늘었어요.' : '줄었어요.'}`}</p>
        {largest.difference !== 0 && <strong>{Math.abs(largest.difference).toFixed(1)}<span>%p {largest.difference > 0 ? '증가' : '감소'}</span></strong>}
      </div>
      <ol id={listId} className="comparison-genres" aria-label="장르 비중 변화">
        {visible.map(change => <li key={change.genre}>
          <div className="comparison-genre-heading"><h3>{change.name}</h3><span className="comparison-difference">
            {change.difference === 0 ? '변화 없음' : `${Math.abs(change.difference).toFixed(1)}%p ${change.difference > 0 ? '증가' : '감소'}`}
          </span></div>
          <div className="comparison-bars">
            <div className="comparison-bar-row"><span>이전 <strong>{change.before.toFixed(1)}%</strong></span><span className="comparison-bar-track" aria-hidden="true"><span style={{ width: Math.min(change.before, 100) + '%' }} /></span></div>
            <div className="comparison-bar-row is-recent"><span>최근 <strong>{change.after.toFixed(1)}%</strong></span><span className="comparison-bar-track" aria-hidden="true"><span style={{ width: Math.min(change.after, 100) + '%' }} /></span></div>
          </div>
        </li>)}
      </ol>
      {changes.length > 2 && <Button className="comparison-expand" variant="ghost" size="small" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? '주요 변화만 보기' : '장르 비교 더 보기'}</Button>}
      <p className="comparison-note">분석한 곡의 장르 비중을 비교해요. 재생 횟수의 변화는 아니에요.</p>
    </> : <p className="comparison-note">비교할 장르 정보가 충분하지 않아요. 기록별 결과에서 분석 내용을 확인해주세요.</p>}
  </section>
}
