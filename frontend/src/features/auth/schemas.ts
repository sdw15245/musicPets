// auth 도메인 API 응답 검증 Zod 스키마. 백엔드 스펙 변경 시 런타임 즉시 감지.
import * as z from 'zod/mini'
import { resolveCharacter } from '../../shared/characterCatalog'

export const MeSchema = z.pipe(z.object({
  id: z.number(),
  spotifyId: z.string(),
  email: z.string(),
  displayName: z.string(),
  nickname: z._default(z.nullable(z.string()), null),
  analyzedPet: z._default(z.nullable(z.string()), null),
  unlockedCharacters: z._default(z.array(z.string()), []),
}), z.transform(me => ({
  ...me,
  analyzedPet: resolveCharacter(me.analyzedPet)?.slug ?? me.analyzedPet,
  unlockedCharacters: [...new Set(me.unlockedCharacters.map(value => resolveCharacter(value)?.slug ?? value))],
})))

export type Me = z.infer<typeof MeSchema>

export const RefreshResponseSchema = z.object({
  access: z.string().check(z.minLength(1)),
})
