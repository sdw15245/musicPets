import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { useAuthStore } from '../auth/useAuthStore'
import { CommentSchema } from './schemas'

const PageSchema = z.object({ items: z.array(CommentSchema), page: z.number(), hasMore: z.boolean() })

export function useComments(postId: string, focusId?: string) {
  const sessionId = useAuthStore(s => s.sessionId)
  return useInfiniteQuery({
    queryKey: ['comments', postId, sessionId, focusId ?? null],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      try {
        const response = await api.get(`/api/posts/${postId}/comments`, { params: { page: pageParam, focus: pageParam === 0 ? focusId : undefined }, signal })
        return PageSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    getNextPageParam: last => last.hasMore ? last.page + 1 : undefined,
    retry: false,
  })
}

export function useCommentMutations(postId: string) {
  const client = useQueryClient()
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['comments', postId] }),
    client.invalidateQueries({ queryKey: ['posts'] }),
  ])
  const save = useMutation({
    mutationFn: async ({ id, body, parentId = null }: { id?: string; body: string; parentId?: string | null }) => {
      try {
        const url = `/api/posts/${postId}/comments`
        const response = id ? await api.put(`${url}/${id}`, { body }) : await api.post(url, { body, parentId })
        return CommentSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      try { await api.delete(`/api/posts/${postId}/comments/${id}`) } catch (error) { throw normalizeError(error) }
    },
    onSuccess: refresh,
  })
  return { save, remove }
}
