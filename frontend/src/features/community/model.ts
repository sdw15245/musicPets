import { characters } from '../../shared/characters'
export type { CommunityPost, CommunityTrack } from './schemas'
export type FeedView = 'discover' | 'mine'
export type Pet = typeof characters[number]
export const getPet = (slug: string | null | undefined) => characters.find(pet => pet.slug === slug)

