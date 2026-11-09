// 커뮤니티 API 응답과 화면 간 전달값을 검증한다.
import { z } from 'zod'

export const CommunityTrackSchema = z.object({
  name: z.string().min(1).max(1000),
  artist: z.string().max(2000),
  uri: z.string().default(''),
  imageUrl: z.string().default(''),
  color: z.enum(['forest', 'violet', 'sunset', 'blue', 'rose', 'sand']).default('forest'),
})

export const CommunityPostSchema = z.object({
  id: z.string(),
  author: z.string(),
  avatarSlug: z.string().nullable().optional(),
  petSlug: z.string().nullable(),
  track: CommunityTrackSchema,
  caption: z.string().min(1).max(280),
  tags: z.array(z.string()),
  createdAt: z.string(),
  likes: z.number().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  liked: z.boolean().default(false),
  own: z.boolean().default(false),
})

export const ShareDraftSchema = z.object({
  shareTrack: CommunityTrackSchema,
  petSlug: z.string().nullable(),
  sourceSessionId: z.string(),
})

export type CommunityTrack = z.infer<typeof CommunityTrackSchema>
export type CommunityPost = z.infer<typeof CommunityPostSchema>

export const CommentSchema = z.object({
  id: z.string(), postId: z.string(), parentId: z.string().nullable(),
  author: z.string(), avatarSlug: z.string().nullable(), body: z.string().max(500),
  createdAt: z.string(), deleted: z.boolean().default(false),
  own: z.boolean().default(false),
})
export type CommunityComment = z.infer<typeof CommentSchema>
