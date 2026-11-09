export function spotifyTrackId(uri: string) {
  return /^spotify:track:([a-zA-Z0-9]{22})$/.exec(uri)?.[1] ?? null
}

/** Spotify URI가 없는 미리보기 곡은 곡명·아티스트 검색으로 연결한다. */
export function spotifyUrl(track: { uri: string; name: string; artist: string }) {
  const match = /^spotify:track:([a-zA-Z0-9]+)$/.exec(track.uri)
  return match ? `https://open.spotify.com/track/${match[1]}`
    : `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`)}`
}
