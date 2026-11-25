// 랜딩의 캐릭터 미리보기 섹션. 매칭될 수 있는 펫 캐릭터 일부를 카드로 노출.
import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from 'seed-design/ui/badge'
import { IconArrowRightLine } from '@karrotmarket/react-monochrome-icon'
import type { LandingPresentation } from './useLandingPresentation'
import { useMyCharacters } from '../../shared/unlockedCharacters'
import { characters } from '../../shared/characters'

const loadPetDetail = () => import('./PetDetailDialog')
const PetDetailDialog = lazy(loadPetDetail)

function CharacterPreviewSection({ presentation }: { presentation: LandingPresentation }) {
  // 아직 만나지 않은 펫은 흐리게 표시하고 이야기를 잠근다.
  const unlocked = useMyCharacters()
  const catalog = characters.map(character => ({
    ...character, discovered: unlocked.includes(character.slug) || unlocked.includes(character.name),
  }))
  const [selected, setSelected] = useState<{ slug: string; open: boolean } | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const selectedPet = catalog.find(pet => pet.slug === selected?.slug)

  return (
    <section className="characters-section section-pad">
      <div className="section-shell">
        <div className="section-head">
          <div>
            <h2 className="wf-h2">어떤 펫을 만나게 될까요?</h2>
          </div>
          <div>
            <p className="wf-sub">
              펫마다 좋아하는 음악이 달라요. 내 취향과 닮은 펫을 만나면 그 펫의 이야기가 열려요.
            </p>
          </div>
        </div>

        <div className="character-grid">
          {catalog.map((c) => {
            const isUnlocked = c.discovered
            return (
            <article key={c.slug} className="character-card">
              <button type="button" className="character-card-trigger" aria-label={`${c.name} 자세히 보기`} aria-haspopup="dialog"
                onPointerEnter={loadPetDetail} onFocus={loadPetDetail} onClick={event => { trigger.current = event.currentTarget; setSelected({ slug: c.slug, open: true }) }}>
              <div className="pet-stage" data-pet={c.slug} data-locked={!isUnlocked || undefined}>
                <img
                  className={`pet-photo pet-img${isUnlocked ? '' : ' is-locked'}`}
                  src={c.imageUrl}
                  alt={c.name}
                  width={640}
                  height={640}
                  loading="lazy"
                />
              </div>
              <div className="character-meta">
                <strong>{c.name}</strong>
                <Badge size="medium" tone={isUnlocked ? 'brand' : 'neutral'} variant="weak">{isUnlocked ? '발견 완료' : '아직 만나기 전'}</Badge>
              </div>
              </button>
            </article>
            )
          })}
          <Link className="character-cta" to={presentation.actionTo} onPointerEnter={presentation.prefetchAction} onFocus={presentation.prefetchAction}>
            <span><strong>{presentation.personal ? '내 펫을 다시 만나볼까요?' : '나와 닮은 펫은 누구일까요?'}</strong>
              <p>{presentation.personal ? '저장된 결과에서 나의 펫과 취향을 확인해요.' : '최근 즐겨 들은 음악으로 나와 가장 닮은 펫을 찾아요.'}</p></span>
            <span className="character-cta-action">{presentation.personal ? '내 취향 보기' : '내 펫 찾기'} <IconArrowRightLine size={18} aria-hidden="true" /></span>
          </Link>
        </div>
      </div>
      {/* The dialog (a bottom sheet on phones) loads on first intent, not with the landing page. */}
      {selectedPet && <Suspense fallback={null}><PetDetailDialog pet={selectedPet} open={selected!.open}
        onOpenChange={open => setSelected(current => current && { ...current, open })}
        onExitComplete={() => { setSelected(null); trigger.current?.focus() }} /></Suspense>}
    </section>
  )
}

export default CharacterPreviewSection
