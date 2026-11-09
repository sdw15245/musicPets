import { genreLabel } from '../analysis/genreLabels'
import { useEffect, useRef, useState } from 'react'

const genreInfo: Record<string, [string, string]> = {
  pop: ['Pop', '귀에 남는 멜로디와 선명한 후렴을 중심으로 펼쳐지는 음악이에요.'],
  rock: ['Rock', '기타와 드럼, 밴드의 생생한 에너지를 만날 수 있는 음악이에요.'],
  indie: ['Indie', '자신만의 색깔과 자유로운 표현이 돋보이는 음악을 만나보세요.'],
  electronic: ['Electronic', '전자음과 비트가 만들어내는 다양한 질감을 탐험해보세요.'],
  'hip-hop': ['Hip-Hop', '리듬 위의 이야기와 개성 있는 플로에 귀를 기울여보세요.'],
  'r-and-b': ['R&B', '그루브와 부드러운 보컬의 조화가 매력적인 음악이에요.'],
  jazz: ['Jazz', '풍부한 화성과 즉흥적인 연주가 새로운 흐름을 만들어내요.'],
  classical: ['Classical', '악기의 울림과 섬세한 구성 속에서 감정의 흐름을 느껴보세요.'],
  folk: ['Folk', '어쿠스틱 사운드와 담백한 이야기로 가까이 다가오는 음악이에요.'],
  metal: ['Metal', '강렬한 기타 사운드와 묵직한 리듬이 중심인 음악이에요.'],
  latin: ['Latin', '다채로운 리듬과 풍부한 멜로디를 가진 음악을 만나보세요.'],
  'k-pop': ['K-Pop', '여러 장르를 넘나드는 사운드와 개성 있는 보컬을 즐겨보세요.'],
  'j-pop': ['J-Pop', '다채로운 편곡과 서정적인 멜로디를 탐험해보세요.'],
}

export default function GenreExplorer({ vector, trackCount, animate = false }: { vector: Record<string, number>; trackCount: number; animate?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!animate || !sectionRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setRevealed(true)
      observer.disconnect()
    }, { threshold: 0.1 })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [animate])
  const genres = Object.entries(vector).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return <section ref={sectionRef} className="genre-explorer" data-animate={animate} data-revealed={revealed} aria-label="청취 기록의 장르 분석">
    <h2>어떤 음악을 들었을까요?</h2><p className="wf-sub">분석한 {trackCount}곡에서 발견한 장르 비중이에요. 곡 수나 재생 횟수의 비율과는 달라요.</p>
    {!genres.length ? <p>장르 정보가 충분하지 않아요.</p> : <ol className="genre-breakdown">{genres.map(([genre, ratio]) => <li key={genre}>
      <details><summary><span>{genreLabel(genre)}</span><span className="genre-track" aria-hidden="true"><span className="genre-fill" style={{ width: Math.min(ratio * 100, 100) + '%' }} /></span><strong>{(ratio * 100).toFixed(1)}%</strong></summary><p>{genreInfo[genre]?.[1] ?? '청취 기록에서 발견한 음악 장르예요.'}</p></details>
    </li>)}</ol>}
  </section>
}
