import { IconMusicalnoteDoubleLine } from '@karrotmarket/react-monochrome-icon'
import { spotifyTrackId } from '../spotify'
import './spotify-player.css'

export default function SpotifyPlayer({ uri, name }: { uri: string; name: string }) {
  const id = spotifyTrackId(uri)
  if (!id) return null
  // The frame is transparent until Spotify paints it, so the slot underneath shows while it loads.
  return <div className="spotify-player">
    <span className="spotify-player-slot" aria-hidden="true">
      <IconMusicalnoteDoubleLine size={24} />
      <span>{name}</span>
    </span>
    <iframe
      title={`${name} Spotify 플레이어`}
      src={`https://open.spotify.com/embed/track/${id}`}
      width="100%"
      height="152"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  </div>
}
