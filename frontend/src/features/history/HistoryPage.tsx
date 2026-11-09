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

export default function HistoryPage() {
  const history = useHistory()
  const remove = useDeleteHistory()
  const [comparing, setComparing] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const records = history.data ?? []
  return <PersonalLayout taste title="분석 기록" description="최근 10회의 음악 취향을 보관해요. 새 기록이 쌓이면 가장 오래된 기록부터 정리돼요.">
    {history.isPending && <MusicListSkeleton label="분석 기록을 불러오고 있어요." />}
    {history.isError && <RequestErrorNotice error={history.error} action={blocked => <Button disabled={blocked} loading={history.isFetching} onClick={() => void history.refetch()}>다시 불러오기</Button>}>분석 기록을 불러오지 못했어요.</RequestErrorNotice>}
    {!history.isPending && !history.isError && !records.length && <ResultSection size="medium" title="아직 분석 기록이 없어요" description="음악 취향을 분석하고 나의 변화를 기록해보세요." actions={<Button asChild variant="brandSolid"><Link to="/analyze">음악 취향 분석하기</Link></Button>} />}
    {records.length > 1 && <div className="history-comparison-toggle"><Button variant="ghost" aria-expanded={comparing} onClick={() => setComparing(value => !value)}>{comparing ? '비교 닫기' : '취향 비교하기'}</Button></div>}
    {records.length > 1 && comparing && <TasteComparison records={records} />}
    <ul className="history-list" aria-label="저장된 분석 기록">{records.map((record, index) => <li className="history-row" key={record.id}>
      <Link className="history-record-link" to={'/history/' + encodeURIComponent(record.id)} aria-label={analysisDate(record.analyzedAt) + ' 기록 자세히 보기'}>
        {record.character ? <img className="history-record-image" src={record.character.imageUrl} alt="" width={64} height={64} /> : <span className="history-record-placeholder" aria-hidden="true">—</span>}
        <div className="history-record-main">
          <div className="history-record-title"><h2>{record.character?.name ?? '아직 만나지 못한 펫'}</h2>{index === 0 && <span className="history-latest">최근 기록</span>}</div>
          <p className="history-record-period">{analysisPeriodLabel(record)} · {record.genres.trackCount}곡 분석</p>
        </div>
        <time className="history-record-date" dateTime={record.analyzedAt} title={analysisDate(record.analyzedAt)}>
          <span>{new Date(record.analyzedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
          <span>{new Date(record.analyzedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        </time>
        <IconChevronRightLine className="history-record-arrow" size={20} aria-hidden="true" />
      </Link>
      <Button size="small" variant="ghost" aria-label="분석 기록 삭제" aria-haspopup="dialog" onClick={() => { remove.reset(); setDeleting(record.id) }}>삭제</Button>
    </li>)}</ul>
    <DeleteConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null) }} title="분석 기록을 삭제할까요?"
      description="이 기록은 다시 볼 수 없어요. 최신 결과를 삭제하면 최근 결과도 비워져요. 수집한 펫은 유지돼요."
      busy={remove.isPending} error={remove.isError ? '삭제하지 못했어요. 다시 시도해주세요.' : undefined} cause={remove.error}
      onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }) }} />
  </PersonalLayout>
}
