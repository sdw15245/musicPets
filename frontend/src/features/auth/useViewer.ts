import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { localUserId, useAuthStore } from './useAuthStore'
import { useHeaderSession } from './useHeaderSession'

/**
 * Cache owner for public data that differs per viewer (feed, posts, comments): likes and own posts.
 * A tab remembered as signed in waits for its session instead of loading the guest view first.
 */
export function useViewer() {
  const key = useAuthStore(state => {
    const userId = localUserId(state.accessToken)
    return userId ? `user:${userId}` : state.accessToken ? `session:${state.sessionId}` : 'guest'
  })
  const { restoring, member } = useHeaderSession()
  return { key, ready: !restoring || member !== true }
}

/** While a signed-in view loads, show the same list already loaded for the guest instead of a skeleton. */
export function useGuestPlaceholder<T>(viewerKey: string, guestKey: QueryKey) {
  const client = useQueryClient()
  return viewerKey === 'guest' ? undefined : () => client.getQueryData<T>(guestKey)
}
