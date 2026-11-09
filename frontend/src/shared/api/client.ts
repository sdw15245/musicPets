// API requests carry the in-memory Bearer token. Only authApi sends cookies.
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { BACKEND_URL } from './config'
import { useAuthStore } from '../../features/auth/useAuthStore'
import { refreshAccessToken, SessionChangedError } from '../../features/auth/session'
import { loginDestination } from '../../features/auth/loginDestination'

export const api = axios.create({
  baseURL: BACKEND_URL,
})

type AuthRequest = InternalAxiosRequestConfig & { _retry?: boolean; _authSessionId?: string }

api.interceptors.request.use((config) => {
  const request = config as AuthRequest
  const { accessToken: token, sessionId } = useAuthStore.getState()
  if (request._authSessionId && request._authSessionId !== sessionId) throw new SessionChangedError()
  request._authSessionId = sessionId
  if (token) config.headers.Authorization = `Bearer ${token}`
  else config.headers.delete('Authorization')
  return config
})

api.interceptors.response.use(
  (res) => {
    if ((res.config as AuthRequest)._authSessionId !== useAuthStore.getState().sessionId) throw new SessionChangedError()
    return res
  },
  async (error: AxiosError) => {
    const original = error.config as AuthRequest | undefined
    const status = error.response?.status

    const { accessToken: token, sessionId } = useAuthStore.getState()
    if (original && original._authSessionId !== sessionId) return Promise.reject(new SessionChangedError())
    if (status === 401 && original && !original._retry && token) {
      original._retry = true
      try {
        // A parallel request may already have replaced the expired token.
        if (original.headers.Authorization === `Bearer ${token}`) await refreshAccessToken()
        return api(original)
      } catch (e) {
        if (!(e instanceof SessionChangedError) && axios.isAxiosError(e)
          && e.response?.status === 401) redirectToLogin()
        return Promise.reject(e)
      }
    }

    return Promise.reject(error)
  },
)

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    const next = loginDestination(window.location.pathname + window.location.search)
    window.location.href = `/login?next=${encodeURIComponent(next)}`
  }
}
