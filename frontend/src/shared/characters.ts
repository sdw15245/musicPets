// Catalog pets with the images screens show. Schemas use ./characterCatalog, which has no bundler features.
import { characters as catalog, resolveCharacter as resolveCatalogPet } from './characterCatalog'

export { currentCharacterText } from './characterCatalog'

// The JSON keeps the 1024px originals for the backend; screens use resized WebP copies
// (scripts/optimize-character-images.py). Hashed asset names let the browser cache them for good.
const images = import.meta.glob<string>('../assets/characters/*.webp', { eager: true, import: 'default', query: '?no-inline' })
const image = (slug: string, size: 192 | 640) => images[`../assets/characters/${slug}-${size}.webp`]

export const characters = catalog.map(pet => ({
  ...pet,
  imageUrl: image(pet.slug, 640) ?? pet.imageUrl,
  /** For avatars and thumbnails up to 96 CSS px. */
  thumbUrl: image(pet.slug, 192) ?? pet.imageUrl,
}))

export function resolveCharacter(value: string | null | undefined) {
  const slug = resolveCatalogPet(value)?.slug
  return characters.find(pet => pet.slug === slug)
}
