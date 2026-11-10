// Run against the configured production API; no user credentials or external analysis calls.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const api = 'https://api.musicpets.store'
const frontend = 'https://musicpets.store'
const request = (path, init = {}) => fetch(api + path, { redirect: 'manual', ...init, signal: AbortSignal.timeout(15000) })

test('custom API domain serves the public API and protects private routes', async () => {
  assert.equal((await request('/healthz')).status, 200)
  const posts = await request('/api/posts?page=0&size=1')
  assert.equal(posts.status, 200)
  assert.match(posts.headers.get('content-type'), /application\/json/)
  await posts.json()
  assert.equal((await request('/api/me')).status, 401)
  assert.equal((await request('/actuator/health/readiness')).status, 404)
})

test('CORS permits credentialed frontend requests and rejects unrelated origins', async () => {
  const headers = { Origin: frontend, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-xsrf-token,content-type' }
  const response = await request('/api/auth/refresh', { method: 'OPTIONS', headers })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), frontend)
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  assert.match(response.headers.get('access-control-allow-headers'), /x-xsrf-token/i)
  const rejected = await request('/api/auth/refresh', { method: 'OPTIONS', headers: { ...headers, Origin: 'https://unrelated.example' } })
  assert.equal(rejected.status, 403)
  assert.equal(rejected.headers.get('access-control-allow-origin'), null)
})

test('auth cookies are secure and host-only, and auth mutations still require CSRF', async () => {
  const response = await request('/api/auth/csrf', { headers: { Origin: frontend } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), frontend)
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('XSRF-TOKEN='))
  assert.ok(cookie)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\/api\/auth/i)
  assert.doesNotMatch(cookie, /Domain=/i)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const csrf = await response.json()
  assert.equal((await request('/api/auth/refresh', { method: 'POST', headers: { Origin: frontend } })).status, 403)
  const expired = await request('/api/auth/refresh', { method: 'POST', headers: { Origin: frontend, Cookie: cookie.split(';')[0], [csrf.headerName]: csrf.token } })
  assert.equal(expired.status, 401)
})

test('Spotify uses the API callback and OAuth failures return to the canonical frontend', async () => {
  const response = await request('/oauth2/authorization/spotify')
  assert.equal(response.status, 302)
  const location = new URL(response.headers.get('location'))
  assert.equal(location.origin, 'https://accounts.spotify.com')
  assert.equal(location.searchParams.get('redirect_uri'), api + '/login/oauth2/code/spotify')
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('JSESSIONID='))
  assert.ok(cookie)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /HttpOnly/i)
  assert.doesNotMatch(cookie, /Domain=/i)
  const failure = await request('/login/oauth2/code/spotify?error=access_denied')
  assert.equal(failure.status, 302)
  assert.equal(failure.headers.get('location'), frontend + '/login?oauthError=spotify')
})
