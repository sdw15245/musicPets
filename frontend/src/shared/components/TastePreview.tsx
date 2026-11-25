import { useEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from '@seed-design/react'
import { IconChevronLeftLine, IconChevronRightLine } from '@karrotmarket/react-monochrome-icon'
import Button from './ui/Button'
import { characters } from '../characters'
import type { AnalysisResult } from '../../features/analysis/schemas'
import { genreLabel } from '../../features/analysis/genreLabels'

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

/** What the card is showing right now, for the page around it to echo. */
export interface ShownTaste {
  pet: string | null
  /** The card's top genres, biggest first. */
  genres: string[]
  /** The example carousel is advancing on its own; it stops on pause, hover, keyboard focus or reduced motion. */
  moving: boolean
}

interface TastePreviewProps {
  analysis?: AnalysisResult | null
  onShow?: (shown: ShownTaste) => void
}

export default function TastePreview({ analysis, onShow }: TastePreviewProps) {
  const [selected, setSelected] = useState(characters[0].slug)
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const autoplayAllowed = useSyncExternalStore(subscribeToAutoplayEnvironment, allowsAutoplay, () => false)
  const showCarousel = !analysis
  const rotating = showCarousel && playing && !hovered && autoplayAllowed
  const selectedIndex = characters.findIndex(item => item.slug === selected)
  const example = characters.find(item => item.slug === selected) ?? characters[0]
  const pet = analysis ? analysis.character : example
  // Previews read like a small result card: the pet on its own stage and its three biggest genres.
  const catalogPet = characters.find(item => item.slug === pet?.slug)
  const vector: Record<string, number> = analysis ? analysis.genres.vector : example.vector
  const genres = Object.entries(vector).filter(([, value]) => value > 0).sort(([, a], [, b]) => b - a).slice(0, 3)
  const shownPet = pet?.slug ?? null
  const shownGenres = pet ? genres.map(([genre]) => genre).join(',') : ''

  useEffect(() => {
    onShow?.({ pet: shownPet, genres: shownGenres ? shownGenres.split(',') : [], moving: rotating })
  }, [onShow, shownPet, shownGenres, rotating])

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

  return <section className="taste-preview pet-stage-animated" data-pet={pet?.slug} aria-label={analysis ? '나의 음악 취향 요약' : '음악 펫 결과 예시'}
    aria-roledescription={showCarousel ? '캐러셀' : undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={event => {
      // Pointer interactions pause on hover; keyboard navigation waits for an explicit restart.
      if (showCarousel && event.target.matches(':focus-visible')) setPlaying(false)
    }}>
    <div className="preview-topline">
      <span className="preview-chip">{analysis ? '나의 음악 펫' : '음악 펫 결과 예시'}</span>
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
      {analysis && <span className="preview-chip">최근 분석</span>}
    </div>
    <div className="preview-content" aria-live={showCarousel ? rotating ? 'off' : 'polite' : undefined} aria-atomic={showCarousel ? true : undefined}
      role={showCarousel ? 'group' : undefined} aria-roledescription={showCarousel ? '슬라이드' : undefined}
      aria-label={showCarousel ? `${selectedIndex + 1} / ${characters.length}: ${example.name}` : undefined}>
    {pet ? <div key={pet.slug} className="preview-pet">
      <div className="pet-stage preview-stage"><img className="pet-photo" src={catalogPet?.imageUrl ?? pet.imageUrl} alt={pet.name} width={640} height={640} /></div>
      <div className="preview-identity">
        {showCarousel && <p className="preview-pet-label">나를 닮은 음악 펫</p>}
        <div className="preview-name-row">
          <h2>{pet.name}</h2>
          {showCarousel && <p className="preview-pet-description">{example.description}</p>}
          {analysis?.character && <span className="preview-tag">{Math.round(analysis.character.score * 100)}% 매칭</span>}
        </div>
      </div>
    </div> : <div className="preview-empty">
      <h2>아직 펫을 찾지 못했어요</h2>
      <p>청취 기록이나 장르 정보가 부족해요. 결과에서 자세한 내용을 확인해주세요.</p>
    </div>}
    {pet && genres.length > 0 && <ul className="preview-genres" aria-label={analysis ? '주요 장르' : '대표 장르'}>{genres.map(([genre, value]) => <li key={genre}>
      <span>{genreLabel(genre)}</span><span className="preview-genre-track" aria-hidden="true"><span style={{ width: value / genres[0][1] * 100 + '%' }} /></span><span>{Math.round(value * 100)}%</span>
    </li>)}</ul>}
    {analysis?.profile?.comment && <p className="preview-summary">{analysis.profile.comment}</p>}
    </div>
    {/* Every pet at a glance; the arrows stay the keyboard path, so these are pointer shortcuts. */}
    {showCarousel && <div className="preview-pager" aria-hidden="true">{characters.map(item => <button type="button" key={item.slug} tabIndex={-1}
      className="preview-pager-item" data-pet={item.slug} data-current={item.slug === selected || undefined} onClick={() => setSelected(item.slug)}>
      <img src={item.thumbUrl} alt="" width={40} height={40} />
    </button>)}</div>}
  </section>
}
