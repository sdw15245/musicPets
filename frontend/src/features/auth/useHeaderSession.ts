import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'

const key = 'musicpets-header-view-v1'
const maxAge = 30 * 60 * 1000
type Hint = { member: boolean; savedAt: number }
function readHint(): Hint | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Hint | null
    return value && typeof value.member === 'boolean' && typeof value.savedAt === 'number'
      && value.savedAt <= Date.now() && Date.now() - value.savedAt < maxAge ? value : null
  } catch { return null }
}
const useHint = create<{ hint: Hint | null }>(() => ({ hint: readHint() }))
// Only header shape, never account data or proof of authentication.
const unsubscribe = useAuthStore.subscribe(state => {
  if (state.status === 'loading') return
  const hint = state.status === 'ready' ? { member: !!state.accessToken, savedAt: Date.now() } : null
  useHint.setState({ hint })
  try {
    if (hint) sessionStorage.setItem(key, JSON.stringify(hint))
    else sessionStorage.removeItem(key)
  } catch { /* Storage is optional. */ }
})
if (import.meta.hot) import.meta.hot.dispose(unsubscribe)

export function useHeaderSession() {
  const signedIn = useAuthStore(state => !!state.accessToken)
  const restoring = useAuthStore(state => state.status === 'loading')
  const hint = useHint(state => state.hint)
  return { signedIn, restoring, member: restoring ? hint?.member ?? null : signedIn }
}
