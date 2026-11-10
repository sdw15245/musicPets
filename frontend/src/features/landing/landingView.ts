import { create } from 'zustand'
import { localUserId, useAuthStore } from '../auth/useAuthStore'

const key = 'musicpets-home-view-v1'
const maxAge = 30 * 60 * 1000
type View = { kind: 'guest' | 'empty' | 'result'; userId: string | null; savedAt: number }

export function freshView(view: View | null) {
  return view && view.savedAt <= Date.now() && Date.now() - view.savedAt < maxAge ? view : null
}
function readView(): View | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const { kind, userId, savedAt } = value as Record<string, unknown>
    if ((kind !== 'guest' && kind !== 'empty' && kind !== 'result') || typeof savedAt !== 'number') return null
    if (kind === 'guest' ? userId !== null : typeof userId !== 'string' || !/^\d+$/.test(userId)) return null
    return freshView({ kind, userId: userId as string | null, savedAt })
  } catch { return null }
}

// Only generic copy selection, never tokens, names, pets, scores or taste data.
// One tab, one last view, at most 30 minutes. This does not establish a session.
export const useLandingView = create<{ view: View | null }>(() => ({ view: readView() }))
export function saveLandingView(view: View | null) {
  useLandingView.setState({ view })
  try {
    if (view) sessionStorage.setItem(key, JSON.stringify(view))
    else sessionStorage.removeItem(key)
  } catch { /* Storage is optional. */ }
}

// Also invalidate when logging out or switching accounts on another app route.
const unsubscribe = useAuthStore.subscribe(state => {
  if (state.status === 'error') saveLandingView(null)
  else if (state.status === 'ready') {
    if (!state.accessToken) saveLandingView({ kind: 'guest', userId: null, savedAt: Date.now() })
    else {
      const view = useLandingView.getState().view
      if (view && (view.kind === 'guest' || view.userId !== localUserId(state.accessToken))) saveLandingView(null)
    }
  }
})

if (import.meta.hot) import.meta.hot.dispose(unsubscribe)
