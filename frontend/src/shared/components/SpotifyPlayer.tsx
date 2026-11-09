import { spotifyTrackId } from '../spotify'

export default function SpotifyPlayer({ uri, name }: { uri: string; name: string }) {
  const id = spotifyTrackId(uri)
  if (!id) return null
  return <iframe
    title={`${name} Spotify 플레이어`}
    src={`https://open.spotify.com/embed/track/${id}`}
    width="100%"
    height="152"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    allowFullScreen
    loading="lazy"
    style={{ border: 0, borderRadius: 12, display: 'block', maxWidth: 480 }}
  />
}
