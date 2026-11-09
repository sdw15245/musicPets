// Evaluated by Vercel, not bundled into the browser.
const value = process.env.BACKEND_ORIGIN
if (!value) throw new Error('Set BACKEND_ORIGIN to the HTTPS backend origin in Vercel.')
const backend = new URL(value)
if (backend.protocol !== 'https:' || backend.pathname !== '/' || backend.search || backend.hash
  || backend.username || backend.password) {
  throw new Error('BACKEND_ORIGIN must be an HTTPS origin without credentials, a path, or query.')
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/oauth2/:path*', destination: `${backend.origin}/oauth2/:path*` },
    { source: '/login/oauth2/:path*', destination: `${backend.origin}/login/oauth2/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [
    ...['/api/:path*', '/oauth2/:path*', '/login/oauth2/:path*'].map(source => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
    })),
  ],
}
