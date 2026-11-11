import { useEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from '@seed-design/react'
import { IconChevronLeftLine, IconChevronRightLine } from '@karrotmarket/react-monochrome-icon'
import Button from './ui/Button'
import { characters } from '../characters'
import type { AnalysisResult } from '../../features/analysis/schemas'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToAutoplayEnvironment(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener('change', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    media.removeEventListener('change', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}

function allowsAutoplay() {
  return !document.hidden && !window.matchMedia(reducedMotionQuery).matches
}

interface TastePreviewProps {
  analysis?: AnalysisResult | null
}

export default function TastePreview({ analysis }: TastePreviewProps) {
  const [selected, setSelected] = useState(characters[0].slug)
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const autoplayAllowed = useSyncExternalStore(subscribeToAutoplayEnvironment, allowsAutoplay, () => false)
  const showCarousel = !analysis
  const rotating = showCarousel && playing && !hovered && autoplayAllowed
  const selectedIndex = characters.findIndex(item => item.slug === selected)
  const example = characters.find(item => item.slug === selected) ?? characters[0]
  const pet = analysis ? analysis.character : example

  useEffect(() => {
    if (!rotating) return
    const timer = window.setTimeout(() => {
      setSelected(characters[(selectedIndex + 1) % characters.length].slug)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [rotating, selectedIndex])

  function moveExample(direction: number) {
    setSelected(characters[(selectedIndex + direction + characters.length) % characters.length].slug)
  }

  return <section className="taste-preview" aria-label={analysis ? '나의 음악 취향 요약' : '음악 펫 결과 예시'}
    aria-roledescription={showCarousel ? '캐러셀' : undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={event => {
      // Pointer interactions pause on hover; keyboard navigation waits for an explicit restart.
      if (showCarousel && event.target.matches(':focus-visible')) setPlaying(false)
    }}>
    <div className="preview-topline">
      <span>{analysis ? '나의 음악 펫' : '음악 펫 결과 예시'}</span>
      {showCarousel && <div className="preview-carousel-controls" role="group" aria-label="펫 예시 넘기기">
        {autoplayAllowed && <Button className="preview-playback" variant="ghost" size="small" layout="iconOnly"
          aria-label={playing ? '자동 전환 멈추기' : '자동 전환 시작하기'}
          title={playing ? '자동 전환 일시정지' : '자동 전환 재생'}
          onClick={() => setPlaying(value => !value)}>
          <Icon aria-hidden="true" svg={<svg viewBox="0 0 24 24">
            <path fill="currentColor" d={playing ? 'M7 5h4v14H7zM14 5h4v14h-4z' : 'M7 4v16l13-8z'} />
          </svg>} />
        </Button>}
        <Button variant="ghost" size="small" layout="iconOnly" aria-label="이전 펫 보기" onClick={() => moveExample(-1)}>
          <Icon svg={<IconChevronLeftLine />} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="small" layout="iconOnly" aria-label="다음 펫 보기" onClick={() => moveExample(1)}>
          <Icon svg={<IconChevronRightLine />} aria-hidden="true" />
        </Button>
      </div>}
      {analysis && <span>최근 분석</span>}
    </div>
    <div className="preview-content" aria-live={showCarousel ? rotating ? 'off' : 'polite' : undefined} aria-atomic={showCarousel ? true : undefined}
      role={showCarousel ? 'group' : undefined} aria-roledescription={showCarousel ? '슬라이드' : undefined}
      aria-label={showCarousel ? `${selectedIndex + 1} / ${characters.length}: ${example.name}` : undefined}>
    {pet ? <div key={pet.slug} className="preview-pet">
      <img src={pet.imageUrl} alt={pet.name} />
      <div className="preview-identity">
        {showCarousel && <p className="preview-pet-label">나를 닮은 음악 펫</p>}
        <h2>{pet.name}</h2>
        {analysis?.character && <span className="preview-tag">{Math.round(analysis.character.score * 100)}% 매칭</span>}
      </div>
    </div> : <div className="preview-empty">
      <h2>아직 펫을 찾지 못했어요</h2>
      <p>청취 기록이나 장르 정보가 부족해요. 결과에서 자세한 내용을 확인해주세요.</p>
    </div>}
    {analysis?.profile?.comment && <p className="preview-summary">{analysis.profile.comment}</p>}
    </div>
  </section>
}
