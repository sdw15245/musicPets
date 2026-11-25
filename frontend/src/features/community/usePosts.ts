import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import * as z from 'zod/mini'
import { api } from '../../shared/api/client'
import { normalizeError } from '../../shared/api/error'
import { useGuestPlaceholder, useViewer } from '../auth/useViewer'
import { CommunityPostSchema } from './schemas'
import type { FeedView } from './model'
import type { FeedSort } from './FeedSortMenu'

const PageSchema = z.object({ items: z.array(CommunityPostSchema), page: z.number(), hasMore: z.boolean() })
const postKeys = ['posts'] as const
export type PostInput = { trackUri: string; caption: string; tags: string[] }

type PostPage = z.infer<typeof PageSchema>

export function usePosts(view: FeedView, filter: string, pet: string | undefined, sort: FeedSort, query: string) {
  const viewer = useViewer()
  const params = [view, filter, pet, sort, query] as const
  const placeholderData = useGuestPlaceholder<InfiniteData<PostPage, number>>(viewer.key, [...postKeys, 'guest', ...params])
  return useInfiniteQuery({
    queryKey: [...postKeys, viewer.key, ...params],
    enabled: viewer.ready,
    placeholderData,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      try {
        const response = await api.get('/api/posts', { params: { view: view === 'mine' ? 'mine' : 'all', filter, pet, sort, q: query || undefined, page: pageParam }, signal })
        return PageSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    getNextPageParam: last => last.hasMore ? last.page + 1 : undefined,
    retry: false,
  })
}

export function usePostMutations() {
  const client = useQueryClient()
  const pendingLikes = useRef(new Set<string>())
  const [pendingLikeIds, setPendingLikeIds] = useState<ReadonlySet<string>>(new Set())
  const refresh = () => client.invalidateQueries({ queryKey: postKeys })
  const save = useMutation({
    mutationFn: async ({ id, ...body }: PostInput & { id?: string }) => {
      try {
        const response = id ? await api.put(`/api/posts/${id}`, body) : await api.post('/api/posts', body)
        return CommunityPostSchema.parse(response.data)
      } catch (error) { throw normalizeError(error) }
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      try { await api.delete(`/api/posts/${id}`) } catch (error) { throw normalizeError(error) }
    },
    onSuccess: refresh,
  })
  const like = useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      try {
        const url = `/api/posts/${id}/like`
        if (liked) await api.put(url)
        else await api.delete(url)
      } catch (error) { throw normalizeError(error) }
    },
    onSuccess: refresh,
  })
  const likePost = async (input: { id: string; liked: boolean }) => {
    if (pendingLikes.current.has(input.id)) return false
    pendingLikes.current.add(input.id)
    setPendingLikeIds(new Set(pendingLikes.current))
    try { await like.mutateAsync(input); return true }
    // The mutation error is displayed by the feed; do not signal success to the card.
    catch { return false }
    finally {
      pendingLikes.current.delete(input.id)
      setPendingLikeIds(new Set(pendingLikes.current))
    }
  }
  return { save, remove, like, pendingLikeIds, likePost }
}
