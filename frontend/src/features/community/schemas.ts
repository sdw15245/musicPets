// 커뮤니티 API 응답과 화면 간 전달값을 검증한다.
import * as z from 'zod/mini'

export const CommunityTrackSchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(1000)),
  artist: z.string().check(z.maxLength(2000)),
  uri: z._default(z.string(), ''),
  imageUrl: z._default(z.string(), ''),
  color: z._default(z.enum(['forest', 'violet', 'sunset', 'blue', 'rose', 'sand']), 'forest'),
})

export const CommunityPostSchema = z.object({
  id: z.string(),
  author: z.string(),
  avatarSlug: z.optional(z.nullable(z.string())),
  petSlug: z.nullable(z.string()),
  track: CommunityTrackSchema,
  caption: z.string().check(z.minLength(1), z.maxLength(280)),
  tags: z.array(z.string()),
  createdAt: z.string(),
  likes: z.number().check(z.nonnegative()),
  commentCount: z.int().check(z.nonnegative()),
  liked: z._default(z.boolean(), false),
  own: z._default(z.boolean(), false),
})

export const ShareDraftSchema = z.object({
  shareTrack: CommunityTrackSchema,
  petSlug: z.nullable(z.string()),
  sourceSessionId: z.string(),
})

export type CommunityTrack = z.infer<typeof CommunityTrackSchema>
export type CommunityPost = z.infer<typeof CommunityPostSchema>

export const CommentSchema = z.object({
  id: z.string(), postId: z.string(), parentId: z.nullable(z.string()),
  author: z.string(), avatarSlug: z.nullable(z.string()), body: z.string().check(z.maxLength(500)),
  createdAt: z.string(), deleted: z._default(z.boolean(), false),
  own: z._default(z.boolean(), false),
})
export type CommunityComment = z.infer<typeof CommentSchema>
