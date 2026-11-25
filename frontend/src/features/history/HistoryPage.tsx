import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronRightLine } from '@karrotmarket/react-monochrome-icon'
import { ResultSection } from 'seed-design/ui/result-section'
import PersonalLayout from '../mypage/PersonalLayout'
import Button from '../../shared/components/ui/Button'
import DeleteConfirmDialog from '../../shared/components/ui/DeleteConfirmDialog'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import TasteComparison from './TasteComparison'
import { useHistory, useDeleteHistory } from './useHistory'
import { analysisDate } from './historyFormat'
import { analysisPeriodLabel } from '../analysis/analysisPeriod'
import { genreLabel } from '../analysis/genreLabels'
import type { AnalysisResult } from '../analysis/schemas'
import ActionsMenu from '../../shared/components/ui/ActionsMenu'
import { resolveCharacter } from '../../shared/characters'

const recordDate = (date: string) => new Date(date).toLocaleString('ko-KR', {
  ...(new Date(date).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' as const }),
  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** What made this record different: its match and its two biggest genres. */
function recordSummary(record: AnalysisResult) {
  const genres = Object.entries(record.genres.vector).filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a).slice(0, 2).map(([genre]) => genreLabel(genre))
  return [record.character && `${Math.round(record.character.score * 100)}% 매칭`, genres.join('·')].filter(Boolean).join(' · ')
}

export default function HistoryPage() {
  const history = useHistory()
  const remove = useDeleteHistory()
  const [comparing, setComparing] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const records = history.data ?? []
  // Oldest to newest, so the strip reads as the path your taste took.
  const journey = records.slice(0, 5).reverse()
  return <PersonalLayout taste title="분석 기록" description="최근 10회의 음악 취향을 보관해요. 새 기록이 쌓이면 가장 오래된 기록부터 정리돼요.">
    {history.isPending && <MusicListSkeleton label="분석 기록을 불러오고 있어요." />}
    {history.isError && <RequestErrorNotice error={history.error} action={blocked => <Button disabled={blocked} loading={history.isFetching} onClick={() => void history.refetch()}>다시 불러오기</Button>}>분석 기록을 불러오지 못했어요.</RequestErrorNotice>}
    {!history.isPending && !history.isError && !records.length && <ResultSection size="medium" title="아직 분석 기록이 없어요" description="음악 취향을 분석하고 나의 변화를 기록해보세요." actions={<Button asChild variant="brandSolid"><Link to="/analyze">음악 취향 분석하기</Link></Button>} />}
    {records.length > 1 && <div className="comparison-card">
      <div className="comparison-teaser">
        <ol className="comparison-journey" aria-hidden="true">{journey.map(record => <li key={record.id} className="pet-stage" data-pet={record.character?.slug}>
          {record.character && <img src={resolveCharacter(record.character.slug)?.thumbUrl ?? record.character.imageUrl} alt="" width={48} height={48} />}
        </li>)}</ol>
        <div className="comparison-teaser-copy"><strong>취향이 어떻게 달라졌을까요?</strong><p>두 기록의 장르 비중과 만난 펫을 나란히 비교해요.</p></div>
        <Button variant={comparing ? 'neutralWeak' : 'brandSolid'} size="medium" aria-expanded={comparing} onClick={() => setComparing(value => !value)}>{comparing ? '비교 닫기' : '취향 비교하기'}</Button>
      </div>
      {comparing && <TasteComparison records={records} />}
    </div>}
    <ul className="history-list" aria-label="저장된 분석 기록">{records.map((record, index) => {
      const pet = resolveCharacter(record.character?.slug)
      return <li className="history-row" key={record.id}>
        <Link className="history-record-link" to={'/history/' + encodeURIComponent(record.id)} aria-label={analysisDate(record.analyzedAt) + ' 기록 자세히 보기'}>
          {record.character ? <span className="history-record-image pet-stage" data-pet={record.character.slug}><img src={pet?.thumbUrl ?? record.character.imageUrl} alt="" width={56} height={56} /></span> : <span className="history-record-placeholder" aria-hidden="true">—</span>}
          <div className="history-record-main">
            <div className="history-record-title"><h2>{record.character?.name ?? '아직 만나지 못한 펫'}</h2>{index === 0 && <span className="history-latest">최근 기록</span>}</div>
            <p className="history-record-summary">{recordSummary(record)}</p>
            <p className="history-record-period">{analysisPeriodLabel(record)} · {record.genres.trackCount}곡 분석</p>
          </div>
          <time className="history-record-date" dateTime={record.analyzedAt} title={analysisDate(record.analyzedAt)}>{recordDate(record.analyzedAt)}</time>
          <IconChevronRightLine className="history-record-arrow" size={20} aria-hidden="true" />
        </Link>
        <ActionsMenu label="분석 기록 더보기" menuLabel="분석 기록 관리" actions={[
          { label: '분석 기록 삭제', critical: true, opensDialog: true, onSelect: () => { remove.reset(); setDeleting(record.id) } },
        ]} />
      </li>
    })}</ul>
    <DeleteConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null) }} title="분석 기록을 삭제할까요?"
      description="이 기록은 다시 볼 수 없어요. 최신 결과를 삭제하면 최근 결과도 비워져요. 수집한 펫은 유지돼요."
      busy={remove.isPending} error={remove.isError ? '삭제하지 못했어요. 다시 시도해주세요.' : undefined} cause={remove.error}
      onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }) }} />
  </PersonalLayout>
}
