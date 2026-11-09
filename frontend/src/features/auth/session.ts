import axios from 'axios'
import { z } from 'zod'
import { BACKEND_URL } from '../../shared/api/config'
import { RefreshResponseSchema } from './schemas'
import { useAuthStore } from './useAuthStore'

const authApi = axios.create({ baseURL: BACKEND_URL, withCredentials: true, timeout: 10_000 })
const CsrfSchema = z.object({ headerName: z.literal('X-XSRF-TOKEN'), token: z.string().min(1) })
let csrf: z.infer<typeof CsrfSchema> | null = null
let refreshing: Promise<string> | null = null
let restoring: Promise<void> | null = null
let loggingOut: Promise<void> | null = null
let generation = 0

export class SessionChangedError extends Error {}

async function authPost(path: '/api/auth/refresh' | '/api/auth/logout') {
  for (let attempt = 0; attempt < 2; attempt++) {
    csrf ??= CsrfSchema.parse((await authApi.get('/api/auth/csrf')).data)
    try {
      return await authApi.post(path, null, { headers: { [csrf.headerName]: csrf.token } })
    } catch (error) {
      // Another tab or a fresh OAuth login can replace the CSRF cookie.
      if (attempt === 0 && axios.isAxiosError(error) && error.response?.status === 403
        && error.response.data?.error === 'CSRF_INVALID') { csrf = null; continue }
      throw error
    }
  }
  throw new Error('인증 요청을 확인하지 못했어요.')
}

export function refreshAccessToken(): Promise<string> {
  if (loggingOut) return Promise.reject(new SessionChangedError())
  if (refreshing) return refreshing
  const started = generation
  const sessionId = useAuthStore.getState().sessionId
  const request = authPost('/api/auth/refresh').then(response => {
    const access = RefreshResponseSchema.parse(response.data).access
    if (started !== generation || sessionId !== useAuthStore.getState().sessionId) throw new SessionChangedError()
    useAuthStore.getState().setAccessToken(access)
    return access
  }).catch(error => {
    if (started === generation && sessionId === useAuthStore.getState().sessionId
      && axios.isAxiosError(error) && error.response?.status === 401) useAuthStore.getState().clear()
    throw error
  }).finally(() => { if (refreshing === request) refreshing = null })
  refreshing = request
  return request
}

export function restoreSession(): Promise<void> {
  if (restoring) return restoring
  useAuthStore.getState().setStatus('loading')
  const request = refreshAccessToken().then(() => {}).catch(error => {
    if (axios.isAxiosError(error) && error.response?.status === 401) return
    if (!(error instanceof SessionChangedError)) useAuthStore.getState().setStatus('error')
  }).finally(() => { if (restoring === request) restoring = null })
  restoring = request
  return request
}

export function logoutSession(): Promise<void> {
  if (loggingOut) return loggingOut
  generation++ // An already-running refresh must never log this page back in.
  const request = authPost('/api/auth/logout').then(() => {
    csrf = null
    useAuthStore.getState().clear()
  }).finally(() => { if (loggingOut === request) loggingOut = null })
  loggingOut = request
  return request
}
