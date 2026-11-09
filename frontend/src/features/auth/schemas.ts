// auth 도메인 API 응답 검증 Zod 스키마. 백엔드 스펙 변경 시 런타임 즉시 감지.
import { z } from 'zod'

export const MeSchema = z.object({
  id: z.number(),
  spotifyId: z.string(),
  email: z.string(),
  displayName: z.string(),
  nickname: z.string().nullable().default(null),
  analyzedPet: z.string().nullable().default(null),
  unlockedCharacters: z.array(z.string()).default([]),
})

export type Me = z.infer<typeof MeSchema>

export const RefreshResponseSchema = z.object({
  access: z.string().min(1),
})
