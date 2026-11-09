// 랜딩의 캐릭터 미리보기 섹션. 매칭될 수 있는 펫 캐릭터 일부를 카드로 노출.
import type { CSSProperties } from 'react'
import { ResponsiveDialog, Portal, ResponsivePair } from '@seed-design/react'
import { Badge } from 'seed-design/ui/badge'
import Button from '../../shared/components/ui/Button'
import { Link } from 'react-router-dom'
import { useMyCharacters } from '../../shared/unlockedCharacters'
import { characters } from '../../shared/characters'

function CharacterPreviewSection() {
  // 매칭으로 획득한 캐릭터만 선명하게 공개(도감 해금). 나머지는 잠금(흐릿).
  const unlocked = useMyCharacters()
  const catalog = characters.map(character => ({
    ...character, discovered: unlocked.includes(character.slug) || unlocked.includes(character.name),
  }))

  return (
    <section className="characters-section section-pad">
      <div className="section-shell">
        <div className="section-head">
          <div>
            <div className="section-kicker">음악 펫</div>
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
              <ResponsiveDialog.Root>
              <ResponsiveDialog.Trigger asChild><button type="button" className="character-card-trigger" aria-label={`${c.name} 자세히 보기`}>
              <div className="pet-stage has-img" style={{ '--pet-color': c.color } as CSSProperties}>
                <img
                  className={`pet-img${isUnlocked ? '' : ' is-locked'}`}
                  src={c.imageUrl}
                  alt={isUnlocked ? c.name : '잠긴 캐릭터'}
                  width={96}
                  height={96}
                  loading="lazy"
                />
                {!isUnlocked && <span className="pet-lock" aria-hidden="true">?</span>}
              </div>
              <div className="character-meta">
                <div>
                  <strong>{c.name}</strong>
                </div>
                <Badge size="medium" tone={isUnlocked ? 'brand' : 'neutral'} variant="weak">{isUnlocked ? '발견 완료' : '아직 만나기 전'}</Badge>
              </div>
              </button></ResponsiveDialog.Trigger>
              <Portal><ResponsiveDialog.Positioner className="pet-detail-layer"><ResponsiveDialog.Backdrop /><ResponsiveDialog.Content className="pet-detail-dialog">
                <ResponsiveDialog.Header><ResponsiveDialog.Title>{c.name}</ResponsiveDialog.Title><ResponsiveDialog.Description>{isUnlocked ? '펫 이야기' : '아직 만나기 전이에요'}</ResponsiveDialog.Description></ResponsiveDialog.Header>
                <ResponsiveDialog.Body className="pet-detail-body">
                  <div className="pet-detail-portrait">
                    <img className={`pet-detail-image${isUnlocked ? '' : ' is-locked'}`} src={c.imageUrl} alt={isUnlocked ? c.name : '아직 발견하지 않은 펫'} />
                    {!isUnlocked && <span className="pet-lock" aria-hidden="true">?</span>}
                  </div>
                  <Badge size="medium" tone={isUnlocked ? 'brand' : 'neutral'} variant="weak">{isUnlocked ? '발견 완료' : '아직 만나기 전'}</Badge>
                  <p>{isUnlocked ? c.story : '펫을 만나면 이야기가 열려요.'}</p>
                </ResponsiveDialog.Body>
                <ResponsiveDialog.Footer>
                  <ResponsivePair gap="x2">
                    <ResponsiveDialog.Action asChild><Button>닫기</Button></ResponsiveDialog.Action>
                    <Button asChild variant="brandSolid"><Link to="/analyze">내 음악 취향 분석하기</Link></Button>
                  </ResponsivePair>
                </ResponsiveDialog.Footer>
              </ResponsiveDialog.Content></ResponsiveDialog.Positioner></Portal>
              </ResponsiveDialog.Root>
            </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default CharacterPreviewSection
