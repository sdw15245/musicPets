import Button from '../../shared/components/ui/Button'
import { Link } from 'react-router-dom'
import { IconArrowRightLine } from '@karrotmarket/react-monochrome-icon'

interface CommunityBridgeProps {
  petSlug?: string
  petName?: string
}

function CommunityBridge({ petSlug, petName }: CommunityBridgeProps) {
  return (
    <div className="community-bridge">
      <Button asChild variant="ghost" size="medium"><Link title={petName ? `${petName}를 만난 사람들이 나누는 음악` : undefined} to={petSlug ? `/community?pet=${encodeURIComponent(petSlug)}` : '/community'}>
        {petSlug ? '같은 펫의 음악 보기' : '사람들의 음악 보기'} <IconArrowRightLine size={16} aria-hidden="true" />
      </Link></Button>
    </div>
  )
}

export default CommunityBridge
