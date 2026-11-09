import { test } from 'node:test'
import assert from 'node:assert/strict'

let run = 0
async function load(origin) {
  if (origin === undefined) delete process.env.BACKEND_ORIGIN
  else process.env.BACKEND_ORIGIN = origin
  return import(`../vercel.mjs?test=${++run}`)
}

test('deployment requires an explicit HTTPS backend origin', async () => {
  for (const origin of [undefined, '', 'http://api.example.com', 'https://api.example.com/path',
    'https://user:password@api.example.com', 'https://api.example.com?token=private']) {
    await assert.rejects(load(origin))
  }
})

test('API and both OAuth legs reach the backend while the callback screen stays in the SPA', async () => {
  const { config } = await load('https://musicpets.duckdns.org/')
  const destinations = new Map(config.rewrites.map(rule => [rule.source, rule.destination]))
  assert.equal(destinations.get('/api/:path*'), 'https://musicpets.duckdns.org/api/:path*')
  assert.equal(destinations.get('/oauth2/:path*'), 'https://musicpets.duckdns.org/oauth2/:path*')
  assert.equal(destinations.get('/login/oauth2/:path*'), 'https://musicpets.duckdns.org/login/oauth2/:path*')
  assert.equal(destinations.get('/(.*)'), '/index.html')
  assert.equal(destinations.has('/oauth/:path*'), false)
})
