// 모든 API 에러를 ApiError로 정규화. HTTP 오류/일반 Error 모두 통일된 형태로 변환.
import { HttpError } from './http'

export class ApiError extends Error {
  status: number
  code?: string
  retryAt?: number

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      this.retryAt = Date.now() + retryAfterSeconds * 1000
    }
  }
}

export function isSpotifyReauthorizationRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'SPOTIFY_REAUTH_REQUIRED'
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof HttpError) {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const data = typeof body === 'object' && body !== null ? body as { message?: string; error?: string; retryAfterSeconds?: number } : undefined
    const message = data?.message ?? data?.error ?? error.message
    const retryAfter = data?.retryAfterSeconds ?? Number(error.response?.headers.get('retry-after') ?? undefined)
    return new ApiError(message, status, data?.error, retryAfter)
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 0)
  }
  return new ApiError('알 수 없는 오류', 0)
}
