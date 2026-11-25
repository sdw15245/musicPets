import * as z from 'zod/mini'
import { BACKEND_URL } from '../../shared/api/config'
import { createClient, HttpError } from '../../shared/api/http'
import { RefreshResponseSchema } from './schemas'
import { useAuthStore } from './useAuthStore'

const authApi = createClient({ baseURL: BACKEND_URL, withCredentials: true, timeout: 10_000 })
const failedWith = (error: unknown, status: number): error is HttpError => error instanceof HttpError && error.response?.status === status
const CsrfSchema = z.object({ headerName: z.literal('X-XSRF-TOKEN'), token: z.string().check(z.minLength(1)) })
type Csrf = z.infer<typeof CsrfSchema>
// The CSRF token is not a credential: page scripts can always read it from /csrf. Keeping it for
// this tab lets a reload restore the session in one request; a rotated token is fetched again below.
const csrfKey = 'musicpets-csrf-v1'
function readCsrf(): Csrf | null {
  try {
    const parsed = CsrfSchema.safeParse(JSON.parse(sessionStorage.getItem(csrfKey) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch { return null }
}
function saveCsrf(value: Csrf | null) {
  csrf = value
  try {
    if (value) sessionStorage.setItem(csrfKey, JSON.stringify(value))
    else sessionStorage.removeItem(csrfKey)
  } catch { /* Storage is optional. */ }
}
let csrf: Csrf | null = readCsrf()
let refreshing: Promise<string> | null = null
let restoring: Promise<void> | null = null
let loggingOut: Promise<void> | null = null
let generation = 0

export class SessionChangedError extends Error {}

async function authPost(path: '/api/auth/refresh' | '/api/auth/logout') {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!csrf) saveCsrf(CsrfSchema.parse((await authApi.get('/api/auth/csrf')).data))
    const { headerName, token } = csrf!
    try {
      return await authApi.post(path, null, { headers: { [headerName]: token } })
    } catch (error) {
      // Another tab or a fresh OAuth login can replace the CSRF cookie.
      if (attempt === 0 && failedWith(error, 403)
        && (error.response?.data as { error?: string } | undefined)?.error === 'CSRF_INVALID') { saveCsrf(null); continue }
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
      && failedWith(error, 401)) useAuthStore.getState().clear()
    throw error
  }).finally(() => { if (refreshing === request) refreshing = null })
  refreshing = request
  return request
}

export function restoreSession(): Promise<void> {
  if (restoring) return restoring
  useAuthStore.getState().setStatus('loading')
  const request = refreshAccessToken().then(() => {}).catch(error => {
    if (failedWith(error, 401)) return
    if (!(error instanceof SessionChangedError)) useAuthStore.getState().setStatus('error')
  }).finally(() => { if (restoring === request) restoring = null })
  restoring = request
  return request
}

export function logoutSession(): Promise<void> {
  if (loggingOut) return loggingOut
  generation++ // An already-running refresh must never log this page back in.
  const request = authPost('/api/auth/logout').then(() => {
    saveCsrf(null)
    useAuthStore.getState().clear()
  }).finally(() => { if (loggingOut === request) loggingOut = null })
  loggingOut = request
  return request
}
