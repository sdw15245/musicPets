import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { useAuthStore } from '../auth/useAuthStore'

const NotificationSchema = z.object({
  id: z.string(), actor: z.string(), avatarSlug: z.string().nullable(),
  kind: z.enum(['LIKE', 'COMMENT', 'REPLY']), postId: z.string(), commentId: z.string().nullable(),
  createdAt: z.string(), read: z.boolean(),
  postPreview: z.string().nullable().optional(), commentPreview: z.string().nullable().optional(),
})
const PageSchema = z.object({ items: z.array(NotificationSchema), page: z.number(), hasMore: z.boolean(), unreadCount: z.number() })

export function useUnreadCount(enabled = true) {
  const sessionId = useAuthStore(s => s.sessionId)
  const signedIn = useAuthStore(s => !!s.accessToken)
  return useQuery({
    queryKey: ['notifications', sessionId, 'count'], enabled: signedIn && enabled, staleTime: 30_000, refetchInterval: 60_000, retry: false,
    queryFn: async ({ signal }) => {
      try { return z.object({ count: z.number() }).parse((await api.get('/api/notifications/unread-count', { signal })).data).count }
      catch (error) { throw normalizeError(error) }
    },
  })
}
export function useNotifications() {
  const sessionId = useAuthStore(s => s.sessionId)
  return useInfiniteQuery({
    queryKey: ['notifications', sessionId, 'list'], initialPageParam: 0, retry: false,
    queryFn: async ({ signal, pageParam }) => {
      try { return PageSchema.parse((await api.get('/api/notifications', { params: { page: pageParam }, signal })).data) }
      catch (error) { throw normalizeError(error) }
    },
    getNextPageParam: last => last.hasMore ? last.page + 1 : undefined,
  })
}
export function useReadNotification() {
  const sessionId = useAuthStore(s => s.sessionId)
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | null) => {
      try { await api.put('/api/notifications/' + (id ? encodeURIComponent(id) + '/read' : 'read')) }
      catch (error) { throw normalizeError(error) }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications', sessionId] }),
  })
}
