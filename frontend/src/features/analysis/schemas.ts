import { z } from 'zod'
import { resolveCharacter, currentCharacterText } from '../../shared/characters'

export const RecommendedTrackSchema = z.object({
  name: z.string(),
  artist: z.string(),
  uri: z.string(),
  imageUrl: z.string(),
})

export const SavePlaylistSchema = z.object({ playlistUrl: z.string() })
export const RecommendedArtistSchema = z.object({
  name: z.string(), uri: z.string().regex(/^spotify:artist:[a-zA-Z0-9]+$/),
  imageUrl: z.string(), basedOn: z.array(z.string()),
})
export type RecommendedArtist = z.infer<typeof RecommendedArtistSchema>

export const AnalysisSchema = z.object({
  id: z.string(),
  analyzedAt: z.string(),
  genres: z.object({
    vector: z.record(z.string(), z.number()),
    unmappedTags: z.array(z.string()),
    tagCount: z.number(),
    trackCount: z.number(),
    timeRange: z.enum(['short_term', 'medium_term', 'long_term']).optional(),
  }),
  character: z.object({
    slug: z.string(), name: z.string(), description: z.string(),
    imageUrl: z.string(), score: z.number().min(0).max(1),
  }).nullable(),
  profile: z.object({
    mainstream: z.number().min(0).max(100).nullable(),
    obscurity: z.number().min(0).max(100).nullable(),
    comment: z.string(),
  }).nullable(),
  profilePending: z.boolean().optional(),
  recommendationsPending: z.boolean().optional(),
  recommendations: z.array(RecommendedTrackSchema),
  recommendedArtists: z.array(RecommendedArtistSchema).nullish(),
  recommendationsAvailable: z.boolean(),
  recommendationLimit: z.object({
    error: z.enum(['SPOTIFY_QUOTA_EXCEEDED', 'SPOTIFY_RATE_LIMITED']),
    message: z.string(), retryAfterSeconds: z.number().nonnegative(), retryAt: z.string(),
  }).nullish(),
  warnings: z.array(z.string()),
}).transform(data => ({
  ...data,
  character: data.character ? { ...data.character, name: resolveCharacter(data.character.slug)?.name ?? data.character.name } : null,
  profile: data.profile ? { ...data.profile, comment: currentCharacterText(data.profile.comment) } : data.profile,
}))

export type AnalysisResult = z.infer<typeof AnalysisSchema>
