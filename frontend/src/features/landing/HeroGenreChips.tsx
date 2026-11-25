import type { CSSProperties } from 'react'
import { genreLabel } from '../analysis/genreLabels'

// Every example pet's top three genres, ordered so that each pet's three sit apart in the scatter.
const exampleGenres = ['pop', 'jazz', 'folk', 'electronic', 'r-and-b', 'indie', 'k-pop', 'hip-hop', 'classical', 'rock']
// Where each chip sits in the strip between the copy and the card, as [left, top] percentages.
const spots = [[8, 4], [52, 10], [0, 19], [44, 27], [14, 37], [56, 45], [4, 55], [40, 64], [18, 74], [54, 83]]

/** A personal result can lead with a genre no example uses; it takes the lowest quiet chip's place. */
function chipGenres(shown: string[]) {
  const chips = [...exampleGenres]
  for (const genre of shown) {
    if (chips.includes(genre)) continue
    for (let slot = chips.length - 1; slot >= 0; slot--) {
      if (!shown.includes(chips[slot])) { chips[slot] = genre; break }
    }
  }
  return chips
}

interface HeroGenreChipsProps {
  /** The genres the card shows; these chips light up in the pet's colour. */
  genres: string[]
  /** Chips drift only while the carousel advances, so its pause button stops both. */
  moving: boolean
}

/** Decoration for wide screens: the card's own genre list is what assistive technology reads. */
export default function HeroGenreChips({ genres, moving }: HeroGenreChipsProps) {
  return <div className="hero-genre-chips" aria-hidden="true" data-moving={moving || undefined}>
    {chipGenres(genres).map((genre, slot) => <span key={slot} className="hero-genre-chip" data-on={genres.includes(genre) || undefined}
      style={{ '--chip-x': `${spots[slot][0]}%`, '--chip-y': `${spots[slot][1]}%`, '--chip-slot': slot } as CSSProperties}>
      {/* The outer span drifts; the face blurs in and out on its own rhythm. */}
      <span className="hero-genre-chip-face">{genreLabel(genre)}</span>
    </span>)}
  </div>
}
