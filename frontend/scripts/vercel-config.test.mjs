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

test('Vercel serves the SPA without forwarding API or OAuth requests', async () => {
  const config = await load()
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
  assert.equal(config.headers?.some(rule => rule.source.startsWith('/api')), undefined)
})

test('old frontend and www hosts redirect to the canonical domain with their paths', async () => {
  const config = await load()
  for (const host of ['music-pets-lilac.vercel.app', 'www.musicpets.store']) {
    const rule = config.redirects.find(rule => rule.has?.some(condition => condition.type === 'host' && condition.value === host))
    assert.ok(rule)
    assert.equal(rule.source, '/:path*')
    assert.equal(rule.destination, 'https://musicpets.store/:path*')
    assert.equal(rule.permanent, true)
  }
  assert.ok(config.redirects.every(rule => rule.has?.length))
})
