import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

async function load() {
  return JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
}

test('deployment routing is static and every rewrite has a literal destination', async () => {
  const config = await load()
  await assert.rejects(access(new URL('../vercel.mjs', import.meta.url)), { code: 'ENOENT' })
  for (const rule of config.rewrites) {
    assert.equal(typeof rule.destination, 'string')
    assert.ok(rule.destination.length > 0)
    assert.equal(rule.destination.includes('$' + '{'), false)
    if (rule.destination.startsWith('http')) assert.equal(new URL(rule.destination).protocol, 'https:')
  }
})

test('API and both OAuth legs reach the backend while the callback screen stays in the SPA', async () => {
  const config = await load()
  const destinations = new Map(config.rewrites.map(rule => [rule.source, rule.destination]))
  assert.equal(destinations.get('/api/:path*'), 'https://musicpets.duckdns.org/api/:path*')
  assert.equal(destinations.get('/oauth2/:path*'), 'https://musicpets.duckdns.org/oauth2/:path*')
  assert.equal(destinations.get('/login/oauth2/:path*'), 'https://musicpets.duckdns.org/login/oauth2/:path*')
  assert.equal(destinations.get('/(.*)'), '/index.html')
  assert.equal(config.rewrites.at(-1).source, '/(.*)')
  assert.equal(destinations.has('/oauth/:path*'), false)
  for (const source of ['/api/:path*', '/oauth2/:path*', '/login/oauth2/:path*']) {
    const rule = config.headers.find(rule => rule.source === source)
    assert.ok(rule.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store')))
  }
})
