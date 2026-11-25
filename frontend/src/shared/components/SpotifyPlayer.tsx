import { useEffect, useRef } from 'react'
import { IconMusicalnoteDoubleLine } from '@karrotmarket/react-monochrome-icon'
import { spotifyTrackId } from '../spotify'
import './spotify-player.css'

/** Spotify's embed is heavy; screens mount it only when someone asks to listen. */
export default function SpotifyPlayer({ uri, name, autoFocus = false }: { uri: string; name: string; autoFocus?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => { if (autoFocus) frame.current?.focus() }, [autoFocus])
  const id = spotifyTrackId(uri)
  if (!id) return null
  // The frame is transparent until Spotify paints it, so the slot underneath shows while it loads.
  return <div className="spotify-player">
    <span className="spotify-player-slot" aria-hidden="true">
      <IconMusicalnoteDoubleLine size={24} />
      <span>{name}</span>
    </span>
    <iframe
      ref={frame}
      title={`${name} Spotify 플레이어`}
      src={`https://open.spotify.com/embed/track/${id}`}
      width="100%"
      height="152"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  </div>
}
