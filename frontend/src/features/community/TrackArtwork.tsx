import { useState } from 'react'
import type { CommunityTrack } from './schemas'
import { IconMusicalnoteDoubleLine } from '@karrotmarket/react-monochrome-icon'

interface TrackArtworkProps {
  track: Pick<CommunityTrack, 'imageUrl'>
  className?: string
}

function TrackArtwork({ track, className = '' }: TrackArtworkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const safeImage = /^https?:\/\//.test(track.imageUrl) || /^\/(?!\/)/.test(track.imageUrl)
  return (
    <div className={`community-art ${className}`} aria-hidden="true">
      {safeImage && failedUrl !== track.imageUrl ? (
        <img src={track.imageUrl} alt="" loading="lazy" onError={() => setFailedUrl(track.imageUrl)} />
      ) : (
        <IconMusicalnoteDoubleLine className="art-placeholder" />
      )}
    </div>
  )
}

export default TrackArtwork
