import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../auth/useAuthStore'
import { useViewer } from '../auth/useViewer'
import { useMe } from '../auth/useAuth'
import { MeSchema } from '../auth/schemas'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { queryKeys } from '../../shared/api/queryKeys'

export function useProfile() {
  const signedIn = useAuthStore(s => !!s.accessToken)
  const sessionId = useAuthStore(s => s.sessionId)
  const owner = useViewer().key
  const me = useMe()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (name: string) => {
      try {
        const response = await api.put('/api/me', { name })
        return MeSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    onSuccess: data => { queryClient.setQueryData(queryKeys.auth.me(sessionId), data) },
  })
  const petSlug = me.data?.analyzedPet ?? null
  return {
    owner, signedIn, petSlug,
    spotifyId: me.data?.spotifyId ?? '',
    loading: signedIn && me.isPending,
    error: me.error,
    reload: me.refetch,
    saving: mutation.isPending,
    name: signedIn ? me.data?.nickname ?? (me.data?.displayName || me.data?.spotifyId || '음악 친구') : '게스트',
    avatarSlug: petSlug,
    save: (name: string) => mutation.mutateAsync(name),
  }
}
