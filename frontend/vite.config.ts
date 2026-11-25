import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { PRODUCTION_API_ORIGIN } from './src/shared/api/origins.ts'

// The production API is another origin far away; open its connections while the JavaScript downloads.
// Session requests send cookies and data requests do not, so the browser keeps two connection pools.
function apiPreconnect(): Plugin {
  let production = false
  return {
    name: 'musicpets-api-preconnect',
    apply: 'build',
    configResolved(config) { production = config.mode === 'production' },
    transformIndexHtml: () => production ? [
      { tag: 'link', attrs: { rel: 'preconnect', href: PRODUCTION_API_ORIGIN }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'preconnect', href: PRODUCTION_API_ORIGIN, crossorigin: '' }, injectTo: 'head' },
    ] : [],
  }
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  server: { host: '127.0.0.1' },
  plugins: [react(), tailwindcss(), seedDesignPlugin({ colorMode: 'light-only', fontScaling: true }), apiPreconnect()],
  resolve: { tsconfigPaths: true },
})
