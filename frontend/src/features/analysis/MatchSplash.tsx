import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../shared/components/ui/Button'
import AnalysisAnimation from './AnalysisAnimation'

export function MatchSplash() {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 10_000)
    return () => window.clearTimeout(timer)
  }, [])
  return <section className="match-splash" aria-labelledby="analysis-wait-title">
    <AnalysisAnimation />
    <div className="match-splash-status" role="status">
      <h1 id="analysis-wait-title">음악 취향을 분석하고 있어요</h1>
      <p>청취 기록에서 취향이 닮은 펫과 추천 아티스트를 찾고 있어요.</p>
      {delayed && <p className="analysis-delay-note">평소보다 시간이 걸리고 있어요. 잠시만 기다려주세요.</p>}
    </div>
    <Button asChild variant="ghost"><Link to="/">홈으로</Link></Button>
    <small className="analysis-animation-credit"><a href="https://rive.app/marketplace/21929-41151-loading-animation-upload-documents/" target="_blank" rel="noreferrer">Animation · alvarosecilla</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small>
  </section>
}
