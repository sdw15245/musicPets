import { useEffect, useState } from 'react'
import { ApiError } from './error'

export type RequestLimitData = { error: string; retryAt: string }
export type RequestLimitState = { quota: boolean; app: boolean; remaining: number; blocked: boolean }

function isLimit(code?: string) {
  return code === 'SPOTIFY_QUOTA_EXCEEDED' || code === 'SPOTIFY_RATE_LIMITED' || code === 'APP_RATE_LIMITED'
}

export function useRequestLimit(errors: unknown[], fallback?: RequestLimitData | null): RequestLimitState | null {
  const error = errors.find((error): error is ApiError => error instanceof ApiError && isLimit(error.code))
  const code = error?.code ?? fallback?.error
  const retryAt = error ? error.retryAt : fallback ? Date.parse(fallback.retryAt) : undefined
  const active = isLimit(code)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [active])
  if (!active) return null
  // 시간이 없는 오류는 즉시 반복 요청을 허용하지 않는다.
  const remaining = retryAt !== undefined && Number.isFinite(retryAt)
    ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0
  return { quota: code === 'SPOTIFY_QUOTA_EXCEEDED', app: code === 'APP_RATE_LIMITED', remaining, blocked: retryAt === undefined || remaining > 0 }
}
