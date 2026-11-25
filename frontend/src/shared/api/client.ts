// API requests carry the in-memory Bearer token. Only the session endpoints (session.ts) send cookies.
import { BACKEND_URL } from './config'
import { createClient, HttpError, send, type HttpResponse, type RequestConfig } from './http'
import { useAuthStore } from '../../features/auth/useAuthStore'
import { refreshAccessToken, SessionChangedError } from '../../features/auth/session'
import { loginDestination } from '../../features/auth/loginDestination'

const backend = { baseURL: BACKEND_URL }

/** A response that arrives after a login, logout or account switch belongs to another session and is dropped. */
async function authorized<T>(config: RequestConfig, sessionId = useAuthStore.getState().sessionId, retried = false): Promise<HttpResponse<T>> {
  const { accessToken: token, sessionId: current } = useAuthStore.getState()
  if (current !== sessionId) throw new SessionChangedError()
  const headers = { ...config.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const response = await send<T>(backend, { ...config, headers })
    if (useAuthStore.getState().sessionId !== sessionId) throw new SessionChangedError()
    return response
  } catch (error) {
    if (error instanceof SessionChangedError) throw error
    const latest = useAuthStore.getState()
    if (latest.sessionId !== sessionId) throw new SessionChangedError()
    if (!retried && latest.accessToken && error instanceof HttpError && error.response?.status === 401) {
      try {
        // A parallel request may already have replaced the expired token.
        if (token === latest.accessToken) await refreshAccessToken()
        return await authorized<T>(config, sessionId, true)
      } catch (e) {
        if (!(e instanceof SessionChangedError) && e instanceof HttpError && e.response?.status === 401) redirectToLogin()
        throw e
      }
    }
    throw error
  }
}

export const api = createClient(backend, authorized)

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    const next = loginDestination(window.location.pathname + window.location.search)
    window.location.href = `/login?next=${encodeURIComponent(next)}`
  }
}
