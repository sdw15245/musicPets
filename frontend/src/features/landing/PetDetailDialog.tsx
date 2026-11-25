import { Portal, ResponsiveDialog, ResponsivePair } from '@seed-design/react'
import { Badge } from 'seed-design/ui/badge'
import { Link } from 'react-router-dom'
import Button from '../../shared/components/ui/Button'
import type { Pet } from '../community/model'

/** Loaded on first intent from the landing pet cards, so the dialog and bottom sheet stay out of the first download. */
export default function PetDetailDialog({ pet, open, onOpenChange, onExitComplete }: {
  pet: Pet & { discovered: boolean }
  open: boolean
  onOpenChange: (open: boolean) => void
  onExitComplete: () => void
}) {
  const unlocked = pet.discovered
  return <ResponsiveDialog.Root open={open} onOpenChange={onOpenChange}>
    <Portal><ResponsiveDialog.Positioner className="pet-detail-layer"><ResponsiveDialog.Backdrop />
      <ResponsiveDialog.Content className="pet-detail-dialog" onAnimationEnd={event => {
        if (!open && event.target === event.currentTarget) onExitComplete()
      }}>
        <ResponsiveDialog.Header><ResponsiveDialog.Title>{pet.name}</ResponsiveDialog.Title><ResponsiveDialog.Description>{unlocked ? '펫 이야기' : '아직 만나기 전이에요'}</ResponsiveDialog.Description></ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="pet-detail-body">
          <div className="pet-stage pet-detail-portrait" data-pet={pet.slug} data-locked={!unlocked || undefined}>
            <img className={`pet-photo pet-detail-image${unlocked ? '' : ' is-locked'}`} src={pet.imageUrl} alt={pet.name} />
          </div>
          <Badge size="medium" tone={unlocked ? 'brand' : 'neutral'} variant="weak">{unlocked ? '발견 완료' : '아직 만나기 전'}</Badge>
          <p>{unlocked ? pet.story : '펫을 만나면 이야기가 열려요.'}</p>
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer>
          <ResponsivePair gap="x2">
            <ResponsiveDialog.Action asChild><Button>닫기</Button></ResponsiveDialog.Action>
            <Button asChild variant="brandSolid"><Link to="/analyze">내 음악 취향 분석하기</Link></Button>
          </ResponsivePair>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog.Content>
    </ResponsiveDialog.Positioner></Portal>
  </ResponsiveDialog.Root>
}
