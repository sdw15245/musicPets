const genreLabels: Record<string, string> = {
  indie: '인디', pop: '팝', rock: '록', 'r-and-b': 'R&B', 'hip-hop': '힙합',
  electronic: '일렉트로닉', jazz: '재즈', classical: '클래식', folk: '포크',
  metal: '메탈', latin: '라틴', 'k-pop': 'K-Pop', 'j-pop': 'J-Pop',
}

export const genreLabel = (genre: string) => genreLabels[genre] ?? genre
