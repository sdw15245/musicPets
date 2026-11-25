// 랜딩의 캐릭터 미리보기 섹션. 매칭될 수 있는 펫 캐릭터 일부를 카드로 노출.
import { lazy, Suspense, useRef, useState } from 'react'
import { Badge } from 'seed-design/ui/badge'
import { useMyCharacters } from '../../shared/unlockedCharacters'
import { characters } from '../../shared/characters'

const loadPetDetail = () => import('./PetDetailDialog')
const PetDetailDialog = lazy(loadPetDetail)

function CharacterPreviewSection() {
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
              <div className="pet-stage" style={isUnlocked ? { backgroundColor: c.color } : undefined}>
                <img
                  className={`pet-img${isUnlocked ? '' : ' is-locked'}`}
                  src={c.thumbUrl}
                  alt={c.name}
                  width={96}
                  height={96}
                  loading="lazy"
                />
              </div>
              <div className="character-meta">
                <div>
                  <strong>{c.name}</strong>
                </div>
                <Badge size="medium" tone={isUnlocked ? 'brand' : 'neutral'} variant="weak">{isUnlocked ? '발견 완료' : '아직 만나기 전'}</Badge>
              </div>
              </button>
            </article>
            )
          })}
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
