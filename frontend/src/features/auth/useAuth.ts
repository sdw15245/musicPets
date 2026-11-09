// 인증 관련 React Query 훅: 현재 사용자 조회(useMe), 로그아웃(useLogout).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { queryKeys } from '../../shared/api/queryKeys'
import { normalizeError } from '../../shared/api/error'
import { MeSchema, type Me } from './schemas'
import { useAuthStore } from './useAuthStore'
import { logoutSession } from './session'

export type { Me }

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionId = useAuthStore((s) => s.sessionId)

  return useQuery<Me>({
    queryKey: queryKeys.auth.me(sessionId),
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/me')
        return MeSchema.parse(data)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    enabled: !!accessToken,
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutSession,
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
