import { useState } from 'react'
import { PrefixIcon } from '@seed-design/react'
import { IconTriangleRightFill } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import SpotifyPlayer from '../../shared/components/SpotifyPlayer'
import { spotifyTrackId, spotifyUrl } from '../../shared/spotify'
import TrackArtwork from './TrackArtwork'
import type { CommunityTrack } from './model'

/** A light track row; the Spotify player loads only after "듣기", so a feed never waits on many embeds. */
export default function PostTrack({ track }: { track: CommunityTrack }) {
  const [listening, setListening] = useState(false)
  const playable = !!spotifyTrackId(track.uri)
  if (listening && playable) return <SpotifyPlayer uri={track.uri} name={track.name} autoFocus />
  return <div className="post-track">
    <a className="post-track-link" href={spotifyUrl(track)} target="_blank" rel="noreferrer" aria-label={`${track.name}, ${track.artist} Spotify에서 열기`}>
      <TrackArtwork track={track} />
      {/* Attribution stays with the metadata and artwork it credits. */}
      <span className="post-trackinfo"><strong>{track.name}</strong><span>{track.artist}</span><SpotifyLogo /></span>
    </a>
    {playable && <Button className="post-track-listen" size="small" aria-label={`${track.name} 듣기`} onClick={() => setListening(true)}>
      <PrefixIcon svg={<IconTriangleRightFill />} />듣기
    </Button>}
  </div>
}
