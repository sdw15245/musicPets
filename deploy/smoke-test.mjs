// Run after starting the isolated HTTP smoke stack (no external API credentials).
import { test } from 'node:test'
import assert from 'node:assert/strict'

const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:8088'
const options = { redirect: 'manual', signal: undefined }
function request(path, init = {}) {
  return fetch(origin + path, { ...options, ...init, signal: AbortSignal.timeout(10_000) })
}

test('Nginx is reachable but does not expose management or frontend routes', async () => {
  assert.equal((await request('/healthz')).status, 200)
  assert.equal((await request('/actuator/health/readiness')).status, 404)
  assert.equal((await request('/')).status, 404)
})

test('public API reads the migrated MySQL database', async () => {
  const response = await request('/api/posts?page=0')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /application\/json/)
  await response.json()
})

test('private APIs remain protected and auth mutations require CSRF', async () => {
  assert.equal((await request('/api/me')).status, 401)
  assert.equal((await request('/api/auth/refresh', { method: 'POST' })).status, 403)
})

test('CSRF cookie and token survive the proxy without caching', async () => {
  const response = await request('/api/auth/csrf')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('XSRF-TOKEN='))
  assert.ok(cookie)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Path=\/api\/auth/i)
  const body = await response.json()
  assert.equal(body.headerName, 'X-XSRF-TOKEN')
  assert.ok(body.token)
})

test('OAuth starts at Spotify with the configured callback and a session cookie', async () => {
  const response = await request('/oauth2/authorization/spotify')
  assert.equal(response.status, 302)
  const target = new URL(response.headers.get('location'))
  assert.equal(target.origin, 'https://accounts.spotify.com')
  assert.equal(target.searchParams.get('redirect_uri'), origin + '/login/oauth2/code/spotify')
  assert.ok(target.searchParams.get('state'))
  assert.ok(response.headers.getSetCookie().some(value => value.startsWith('JSESSIONID=')))
})
