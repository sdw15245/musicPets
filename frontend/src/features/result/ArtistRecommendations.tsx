import { useState } from 'react'
import { IconArrowUpRightLine, IconPersonLine } from '@karrotmarket/react-monochrome-icon'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import type { RecommendedArtist } from '../analysis/schemas'
import './artist-recommendations.css'

function ArtistPortrait({ artist }: { artist: RecommendedArtist }) {
  const [failed, setFailed] = useState(false)
  return <span className="artist-portrait" aria-hidden="true">
    {artist.imageUrl && !failed ? <img src={artist.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : <IconPersonLine size={28} />}
  </span>
}

export default function ArtistRecommendations({ artists }: { artists: RecommendedArtist[] }) {
  return <ul className="artist-recommendations">
    {artists.map(artist => <li key={artist.uri}>
      <a className="artist-recommendation" href={`https://open.spotify.com/artist/${artist.uri.split(':')[2]}`} target="_blank" rel="noreferrer" aria-label={`${artist.name} Spotify에서 듣기 (새 탭)`}>
        <ArtistPortrait artist={artist} />
        <span className="artist-recommendation-copy"><strong>{artist.name}</strong>
          {artist.basedOn.length > 0 && <span className="artist-recommendation-reason">{artist.basedOn.slice(0, 2).join(' · ')}와 비슷한 아티스트</span>}
          <span className="artist-recommendation-link"><SpotifyLogo /><span>에서 듣기</span></span>
        </span>
        <IconArrowUpRightLine size={20} aria-hidden="true" />
      </a>
    </li>)}
  </ul>
}
