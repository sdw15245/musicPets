// A small fetch client: JSON bodies, query params, timeouts, abort signals,
// and errors that keep the server's status, body and headers.

export interface RequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Milliseconds; 0 or undefined waits without a limit. */
  timeout?: number
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  headers: Headers
}

/** A failed request. `response` is absent when the server never answered (network, timeout, abort). */
export class HttpError extends Error {
  response?: HttpResponse

  constructor(message: string, response?: HttpResponse) {
    super(message)
    this.name = 'HttpError'
    this.response = response
  }
}

export interface HttpClientOptions {
  baseURL: string
  /** Send this site's cookies to the other origin (session endpoints only). */
  withCredentials?: boolean
  timeout?: number
}

export interface RequestConfig extends RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  data?: unknown
}

function buildUrl(baseURL: string, url: string, params: RequestOptions['params']) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) query.append(key, String(value))
  }
  const search = query.toString()
  return baseURL + url + (search ? (url.includes('?') ? '&' : '?') + search : '')
}

async function readBody(response: Response) {
  const text = await response.text()
  if (!text) return undefined
  try { return JSON.parse(text) as unknown } catch { return text }
}

export async function send<T = unknown>(client: HttpClientOptions, config: RequestConfig): Promise<HttpResponse<T>> {
  const controller = new AbortController()
  const timeout = config.timeout ?? client.timeout ?? 0
  // The browser's own timer, like XHR's timeout: page timers can be paused or faked without cutting requests short.
  const timer = timeout > 0 ? AbortSignal.timeout(timeout) : undefined
  const sources = [config.signal, timer].filter(signal => signal !== undefined)
  const abort = () => controller.abort()
  for (const signal of sources) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', abort, { once: true })
  }
  const headers: Record<string, string> = { Accept: 'application/json', ...config.headers }
  const hasBody = config.data !== undefined && config.data !== null
  if (hasBody) headers['Content-Type'] = 'application/json'
  try {
    let response: Response
    try {
      response = await fetch(buildUrl(client.baseURL, config.url, config.params), {
        method: config.method,
        headers,
        body: hasBody ? JSON.stringify(config.data) : undefined,
        credentials: client.withCredentials ? 'include' : 'same-origin',
        signal: controller.signal,
      })
    } catch (error) {
      if (timer?.aborted) throw new HttpError(`timeout of ${timeout}ms exceeded`)
      if (config.signal?.aborted) throw new HttpError('canceled')
      throw new HttpError(error instanceof Error ? error.message : 'Network Error')
    }
    const result: HttpResponse<T> = { data: await readBody(response) as T, status: response.status, headers: response.headers }
    if (!response.ok) throw new HttpError(`Request failed with status code ${response.status}`, result)
    return result
  } finally {
    for (const signal of sources) signal.removeEventListener('abort', abort)
  }
}

/** The four verbs as methods, bound to one origin and credential mode. */
export function createClient(client: HttpClientOptions, request: <T>(config: RequestConfig) => Promise<HttpResponse<T>> = config => send(client, config)) {
  return {
    get: <T = unknown>(url: string, options?: RequestOptions) => request<T>({ ...options, method: 'GET', url }),
    post: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) => request<T>({ ...options, method: 'POST', url, data }),
    put: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) => request<T>({ ...options, method: 'PUT', url, data }),
    delete: <T = unknown>(url: string, options?: RequestOptions) => request<T>({ ...options, method: 'DELETE', url }),
  }
}
