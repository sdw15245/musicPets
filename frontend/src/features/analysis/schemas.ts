// zod/mini keeps only the validators in use; the chained API would ship all of them in the first download.
import * as z from 'zod/mini'
import { resolveCharacter, currentCharacterText } from '../../shared/characterCatalog'

export const RecommendedTrackSchema = z.object({
  name: z.string(),
  artist: z.string(),
  uri: z.string(),
  imageUrl: z.string(),
})

export const SavePlaylistSchema = z.object({ playlistUrl: z.string() })
export const RecommendedArtistSchema = z.object({
  name: z.string(), uri: z.string().check(z.regex(/^spotify:artist:[a-zA-Z0-9]+$/)),
  imageUrl: z.string(), basedOn: z.array(z.string()),
})
export type RecommendedArtist = z.infer<typeof RecommendedArtistSchema>

export const AnalysisSchema = z.pipe(z.object({
  id: z.string(),
  analyzedAt: z.string(),
  genres: z.object({
    vector: z.record(z.string(), z.number()),
    unmappedTags: z.array(z.string()),
    tagCount: z.number(),
    trackCount: z.number(),
    timeRange: z.optional(z.enum(['short_term', 'medium_term', 'long_term'])),
  }),
  character: z.nullable(z.object({
    slug: z.string(), name: z.string(), description: z.string(),
    imageUrl: z.string(), score: z.number().check(z.minimum(0), z.maximum(1)),
  })),
  profile: z.nullable(z.object({
    mainstream: z.nullable(z.number().check(z.minimum(0), z.maximum(100))),
    obscurity: z.nullable(z.number().check(z.minimum(0), z.maximum(100))),
    comment: z.string(),
  })),
  profilePending: z.optional(z.boolean()),
  recommendationsPending: z.optional(z.boolean()),
  recommendations: z.array(RecommendedTrackSchema),
  recommendedArtists: z.nullish(z.array(RecommendedArtistSchema)),
  recommendationsAvailable: z.boolean(),
  recommendationLimit: z.nullish(z.object({
    error: z.enum(['SPOTIFY_QUOTA_EXCEEDED', 'SPOTIFY_RATE_LIMITED']),
    message: z.string(), retryAfterSeconds: z.number().check(z.nonnegative()), retryAt: z.string(),
  })),
  warnings: z.array(z.string()),
}), z.transform(data => ({
  ...data,
  character: data.character ? { ...data.character, name: resolveCharacter(data.character.slug)?.name ?? data.character.name } : null,
  profile: data.profile ? { ...data.profile, comment: currentCharacterText(data.profile.comment) } : data.profile,
})))

export type AnalysisResult = z.infer<typeof AnalysisSchema>
