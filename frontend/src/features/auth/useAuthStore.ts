// Access lives only in this page's memory. The browser owns the HttpOnly refresh cookie.
import { create } from 'zustand'

// subject는 브라우저 기록 분리용이다. API 접근 권한은 서버가 검증한다.
export function localUserId(accessToken: string | null): string | null {
  if (!accessToken) return null
  try {
    const encoded = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { sub } = JSON.parse(atob(encoded)) as { sub?: unknown }
    return typeof sub === 'string' && /^\d+$/.test(sub) ? sub : null
  } catch {
    return null
  }
}

export function useUserId() {
  return useAuthStore((state) => localUserId(state.accessToken))
}

interface AuthState {
  sessionId: string
  accessToken: string | null
  status: 'loading' | 'ready' | 'error'
  setAccessToken: (access: string) => void
  setStatus: (status: AuthState['status']) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessionId: crypto.randomUUID(),
  accessToken: null,
  status: 'loading',
  setAccessToken: (access) => set(state => ({
    accessToken: access, status: 'ready',
    sessionId: !state.accessToken || localUserId(state.accessToken) !== localUserId(access)
      ? crypto.randomUUID() : state.sessionId,
  })),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, status: 'ready', sessionId: crypto.randomUUID() }),
}))
