import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const dist = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'))
const initialFiles = new Set()

function collectInitialFiles(key) {
  const chunk = manifest[key]
  if (initialFiles.has(chunk.file)) return
  initialFiles.add(chunk.file)
  for (const dependency of chunk.imports ?? []) collectInitialFiles(dependency)
}

for (const [key, chunk] of Object.entries(manifest)) {
  if (chunk.isEntry) collectInitialFiles(key)
}

const scripts = [...new Set(Object.values(manifest).map(chunk => chunk.file))]
  .filter(file => file.endsWith('.js'))
  .map(file => {
    const content = readFileSync(new URL(file, dist))
    return { file, bytes: content.length, gzip: gzipSync(content).length }
  })
const initialGzip = scripts.filter(script => initialFiles.has(script.file))
  .reduce((sum, script) => sum + script.gzip, 0)
const largest = Math.max(...scripts.map(script => script.bytes))

console.log(`Initial JavaScript: ${(initialGzip / 1000).toFixed(2)} kB gzip; largest chunk: ${(largest / 1000).toFixed(2)} kB`)
if (initialGzip > 220_000 || largest > 500_000) {
  throw new Error('JavaScript budget exceeded: initial gzip <= 220 kB and each chunk <= 500 kB.')
}
